const pool = require("../config/db");

async function sellerMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        sp.id,
        sp.user_id,
        sp.seller_type,
        sp.seller_status,
        sp.display_name,
        sp.description,
        sp.verification_date
      FROM seller_profiles sp
      WHERE sp.user_id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Seller profile not found",
      });
    }

    const seller = result.rows[0];

    if (seller.seller_status !== "verified") {
      return res.status(403).json({
        success: false,
        message:
          "Your seller account is not verified yet. Please complete verification before selling.",
        sellerStatus: seller.seller_status,
      });
    }

    req.seller = seller;

    next();
  } catch (error) {
    console.error("Seller middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify seller account",
    });
  }
}

module.exports = sellerMiddleware;