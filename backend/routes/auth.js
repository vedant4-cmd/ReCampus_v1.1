const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// --------------------------------------------------
// Helper: Create JWT
// --------------------------------------------------

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

// --------------------------------------------------
// POST /api/auth/register
// --------------------------------------------------

router.post("/register", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
    name,
    email,
    mobile,
    password,
    accountType,
    seller_type,
    business_name: businessName,
    owner_name: ownerName,
    business_mobile: businessMobile,
    business_address: businessAddress,
    gst_number: gstNumber,
    shop_establishment_number: shopEstablishmentNumber,
    udyam_number: udyamNumber,
    pan_number: panNumber
} = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Validate account type
    const allowedAccountTypes = ["buyer", "student", "business"];

    if (!allowedAccountTypes.includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account type",
      });
    }

    await client.query("BEGIN");

    const hashedPassword = await bcrypt.hash(password, 12);

    const role = accountType === "buyer" ? "buyer" : "seller";

    const userResult = await client.query(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        mobile,
        role
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        name,
        email,
        mobile,
        role,
        account_status,
        email_verified,
        mobile_verified,
        created_at
      `,
      [
        name.trim(),
        normalizedEmail,
        hashedPassword,
        mobile || null,
        role,
      ]
    );

    const user = userResult.rows[0];

    let sellerProfile = null;

    // --------------------------------------------------
    // Student Seller
    // --------------------------------------------------

    if (accountType === "student") {
      const sellerResult = await client.query(
        `
        INSERT INTO seller_profiles
        (
          user_id,
          seller_type,
          seller_status,
          display_name
        )
        VALUES ($1, 'student', 'pending', $2)
        RETURNING *
        `,
        [user.id, name.trim()]
      );

      sellerProfile = sellerResult.rows[0];

      await client.query(
        `
        INSERT INTO student_verifications
        (
          seller_id,
          college_id,
          college_email,
          student_id_number,
          expected_graduation_year
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          sellerProfile.id,
          collegeId || null,
          collegeEmail || null,
          studentIdNumber || null,
          expectedGraduationYear || null,
        ]
      );
    }

    // --------------------------------------------------
    // Business Seller
    // --------------------------------------------------

    if (accountType === "business") {
      if (!businessName || !ownerName) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "Business name and owner name are required for business accounts",
        });
      }

      const sellerResult = await client.query(
        `
        INSERT INTO seller_profiles
        (
          user_id,
          seller_type,
          seller_status,
          display_name
        )
        VALUES ($1, 'business', 'pending', $2)
        RETURNING *
        `,
        [user.id, businessName.trim()]
      );

      sellerProfile = sellerResult.rows[0];

      await client.query(
        `
        INSERT INTO business_verifications
        (
          seller_id,
          business_name,
          owner_name,
          mobile,
          business_address,
          gst_number,
          shop_establishment_number,
          udyam_number,
          pan_number
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
        `,
        [
          sellerProfile.id,
          businessName.trim(),
          ownerName.trim(),
          businessMobile || mobile || null,
          businessAddress || null,
          gstNumber || null,
          shopEstablishmentNumber || null,
          udyamNumber || null,
          panNumber || null,
        ]
      );
    }

    await client.query("COMMIT");

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message:
        accountType === "buyer"
          ? "Registration successful"
          : "Registration successful. Your seller verification is pending.",
      token,
      user,
      seller: sellerProfile,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  } finally {
    client.release();
  }
});

// --------------------------------------------------
// POST /api/auth/login
// --------------------------------------------------

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        password,
        mobile,
        role,
        account_status,
        email_verified,
        mobile_verified,
        created_at
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    if (user.account_status !== "active") {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.account_status}`,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    delete user.password;

    const sellerResult = await pool.query(
      `
      SELECT
        sp.*,
        sv.college_id,
        sv.college_email,
        sv.college_email_verified,
        sv.student_id_number,
        sv.expected_graduation_year,
        sv.student_status,
        sv.verification_method,
        sv.verification_status AS student_verification_status,
        bv.business_name,
        bv.owner_name,
        bv.gst_number,
        bv.shop_establishment_number,
        bv.udyam_number,
        bv.pan_number,
        bv.verification_status AS business_verification_status
      FROM seller_profiles sp
      LEFT JOIN student_verifications sv
        ON sv.seller_id = sp.id
      LEFT JOIN business_verifications bv
        ON bv.seller_id = sp.id
      WHERE sp.user_id = $1
      `,
      [user.id]
    );

    const seller =
      sellerResult.rows.length > 0 ? sellerResult.rows[0] : null;

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user,
      seller,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

// --------------------------------------------------
// GET /api/auth/me
// --------------------------------------------------

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        mobile,
        role,
        account_status,
        email_verified,
        mobile_verified,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const sellerResult = await pool.query(
      `
      SELECT
        sp.*,
        sv.college_id,
        sv.college_email,
        sv.college_email_verified,
        sv.student_id_number,
        sv.expected_graduation_year,
        sv.student_status,
        sv.verification_method,
        sv.verification_status AS student_verification_status,
        bv.business_name,
        bv.owner_name,
        bv.mobile AS business_mobile,
        bv.business_address,
        bv.gst_number,
        bv.shop_establishment_number,
        bv.udyam_number,
        bv.pan_number,
        bv.verification_status AS business_verification_status
      FROM seller_profiles sp
      LEFT JOIN student_verifications sv
        ON sv.seller_id = sp.id
      LEFT JOIN business_verifications bv
        ON bv.seller_id = sp.id
      WHERE sp.user_id = $1
      `,
      [req.user.id]
    );

    return res.json({
      success: true,
      user: userResult.rows[0],
      seller:
        sellerResult.rows.length > 0 ? sellerResult.rows[0] : null,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load user information",
    });
  }
});

// --------------------------------------------------
// POST /api/auth/logout
// --------------------------------------------------

router.post("/logout", authMiddleware, (req, res) => {
  // JWT is stateless.
  // The frontend removes the token from localStorage.
  res.json({
    success: true,
    message: "Logout successful",
  });
});

module.exports = router;