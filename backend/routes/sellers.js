const express = require("express");

const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// --------------------------------------------------
// GET /api/sellers/me
// --------------------------------------------------

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        sp.*,

        sv.college_id,
        sv.college_email,
        sv.college_email_verified,
        sv.student_id_number,
        sv.student_id_document,
        sv.expected_graduation_year,
        sv.student_status,
        sv.verification_method,
        sv.verification_status AS student_verification_status,
        sv.verified_at AS student_verified_at,

        bv.business_name,
        bv.owner_name,
        bv.mobile AS business_mobile,
        bv.business_address,
        bv.gst_number,
        bv.shop_establishment_number,
        bv.udyam_number,
        bv.pan_number,
        bv.verification_status AS business_verification_status,
        bv.verified_at AS business_verified_at

      FROM seller_profiles sp

      LEFT JOIN student_verifications sv
        ON sv.seller_id = sp.id

      LEFT JOIN business_verifications bv
        ON bv.seller_id = sp.id

      WHERE sp.user_id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Seller profile not found",
      });
    }

    res.json({
      success: true,
      seller: result.rows[0],
    });
  } catch (error) {
    console.error("Get seller profile error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load seller profile",
    });
  }
});

// --------------------------------------------------
// PUT /api/sellers/me
// --------------------------------------------------

router.put("/me", authMiddleware, async (req, res) => {
  try {
    const {
      displayName,
      description,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE seller_profiles
      SET
        display_name = COALESCE($1, display_name),
        description = COALESCE($2, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
      RETURNING *
      `,
      [
        displayName || null,
        description || null,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Seller profile not found",
      });
    }

    res.json({
      success: true,
      message: "Seller profile updated",
      seller: result.rows[0],
    });
  } catch (error) {
    console.error("Update seller profile error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update seller profile",
    });
  }
});

// --------------------------------------------------
// GET /api/sellers
// Admin: list seller applications
// --------------------------------------------------

router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const status = req.query.status;

      let query = `
        SELECT
          sp.*,
          u.name,
          u.email,
          u.mobile,

          sv.college_id,
          sv.college_email,
          sv.student_id_number,
          sv.verification_status AS student_verification_status,

          bv.business_name,
          bv.owner_name,
          bv.gst_number,
          bv.pan_number,
          bv.verification_status AS business_verification_status

        FROM seller_profiles sp

        JOIN users u
          ON u.id = sp.user_id

        LEFT JOIN student_verifications sv
          ON sv.seller_id = sp.id

        LEFT JOIN business_verifications bv
          ON bv.seller_id = sp.id
      `;

      const params = [];

      if (status) {
        query += " WHERE sp.seller_status = $1";
        params.push(status);
      }

      query += " ORDER BY sp.created_at DESC";

      const result = await pool.query(query, params);

      res.json({
        success: true,
        sellers: result.rows,
      });
    } catch (error) {
      console.error("List sellers error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to load sellers",
      });
    }
  }
);

// --------------------------------------------------
// PUT /api/sellers/:id/verify
// Admin verification
// --------------------------------------------------

router.put(
  "/:id/verify",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const sellerId = Number(req.params.id);

      if (!Number.isInteger(sellerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid seller ID",
        });
      }

      await client.query("BEGIN");

      const sellerResult = await client.query(
        `
        UPDATE seller_profiles
        SET
          seller_status = 'verified',
          verification_date = CURRENT_TIMESTAMP,
          verified_by = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
        `,
        [req.user.id, sellerId]
      );

      if (sellerResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Seller not found",
        });
      }

      const seller = sellerResult.rows[0];

      if (seller.seller_type === "student") {
        await client.query(
          `
          UPDATE student_verifications
          SET
            verification_status = 'verified',
            verification_method = COALESCE(
              verification_method,
              'admin'
            ),
            verified_at = CURRENT_TIMESTAMP
          WHERE seller_id = $1
          `,
          [sellerId]
        );
      }

      if (seller.seller_type === "business") {
        await client.query(
          `
          UPDATE business_verifications
          SET
            verification_status = 'verified',
            verified_at = CURRENT_TIMESTAMP,
            verified_by = $1
          WHERE seller_id = $2
          `,
          [req.user.id, sellerId]
        );
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Seller verified successfully",
        seller,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Verify seller error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to verify seller",
      });
    } finally {
      client.release();
    }
  }
);

// --------------------------------------------------
// PUT /api/sellers/:id/reject
// Admin rejection
// --------------------------------------------------

router.put(
  "/:id/reject",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const sellerId = Number(req.params.id);
      const { reason } = req.body;

      if (!Number.isInteger(sellerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid seller ID",
        });
      }

      await client.query("BEGIN");

      const sellerResult = await client.query(
        `
        UPDATE seller_profiles
        SET
          seller_status = 'rejected',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
        `,
        [sellerId]
      );

      if (sellerResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Seller not found",
        });
      }

      const seller = sellerResult.rows[0];

      if (seller.seller_type === "student") {
        await client.query(
          `
          UPDATE student_verifications
          SET verification_status = 'rejected'
          WHERE seller_id = $1
          `,
          [sellerId]
        );
      }

      if (seller.seller_type === "business") {
        await client.query(
          `
          UPDATE business_verifications
          SET
            verification_status = 'rejected',
            rejection_reason = $1
          WHERE seller_id = $2
          `,
          [reason || "Verification rejected", sellerId]
        );
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Seller application rejected",
        reason: reason || "Verification rejected",
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Reject seller error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to reject seller",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;