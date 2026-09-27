const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);


/*
|--------------------------------------------------------------------------
| Dashboard statistics
|--------------------------------------------------------------------------
*/

router.get("/stats", async (req, res) => {
    try {
        const users = await pool.query(`
            SELECT COUNT(*)::int AS count
            FROM users
        `);

        const sellers = await pool.query(`
            SELECT COUNT(*)::int AS count
            FROM seller_profiles
        `);

        const pendingSellers = await pool.query(`
            SELECT COUNT(*)::int AS count
            FROM seller_profiles
            WHERE seller_status = 'pending'
        `);

        const products = await pool.query(`
            SELECT COUNT(*)::int AS count
            FROM products
            WHERE status = 'active'
        `);

        const orders = await pool.query(`
            SELECT COUNT(*)::int AS count
            FROM orders
        `);

        const revenue = await pool.query(`
            SELECT COALESCE(SUM(total_amount), 0) AS total
            FROM orders
            WHERE payment_status = 'paid'
        `);

        res.json({
            success: true,
            stats: {
                users: users.rows[0].count,
                sellers: sellers.rows[0].count,
                pendingSellers: pendingSellers.rows[0].count,
                products: products.rows[0].count,
                orders: orders.rows[0].count,
                revenue: revenue.rows[0].total
            }
        });

    } catch (error) {
        console.error("Admin stats error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load admin statistics."
        });
    }
});


/*
|--------------------------------------------------------------------------
| Pending seller verification requests
|--------------------------------------------------------------------------
*/

router.get("/sellers/pending", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                sp.id,
                sp.user_id,
                sp.seller_type,
                sp.seller_status,
                sp.display_name,
                sp.description,
                sp.created_at,

                u.name,
                u.email,
                u.mobile,

                sv.college_id,
                c.name AS college_name,
                sv.college_email,
                sv.college_email_verified,
                sv.student_id_number,
                sv.expected_graduation_year,
                sv.student_status,
                sv.verification_method,
                sv.verification_status,

                bv.business_name,
                bv.owner_name,
                bv.business_address,
                bv.gst_number,
                bv.shop_establishment_number,
                bv.udyam_number,
                bv.pan_number

            FROM seller_profiles sp

            JOIN users u
                ON u.id = sp.user_id

            LEFT JOIN student_verifications sv
                ON sv.seller_id = sp.id

            LEFT JOIN colleges c
                ON c.id = sv.college_id

            LEFT JOIN business_verifications bv
                ON bv.seller_id = sp.id

            WHERE sp.seller_status = 'pending'

            ORDER BY sp.created_at ASC
        `);

        res.json({
            success: true,
            sellers: result.rows
        });

    } catch (error) {
        console.error(
            "Pending seller error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load pending sellers."
        });
    }
});


/*
|--------------------------------------------------------------------------
| All sellers
|--------------------------------------------------------------------------
*/

router.get("/sellers", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                sp.id,
                sp.user_id,
                sp.seller_type,
                sp.seller_status,
                sp.display_name,
                sp.created_at,

                u.name,
                u.email,
                u.mobile

            FROM seller_profiles sp

            JOIN users u
                ON u.id = sp.user_id

            ORDER BY sp.created_at DESC
        `);

        res.json({
            success: true,
            sellers: result.rows
        });

    } catch (error) {
        console.error(
            "Seller list error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load sellers."
        });
    }
});


/*
|--------------------------------------------------------------------------
| Approve seller
|--------------------------------------------------------------------------
*/

router.patch("/sellers/:sellerId/approve", async (req, res) => {

    const sellerId =
        Number(req.params.sellerId);

    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid seller ID."
        });
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const sellerResult = await client.query(`
            SELECT
                id,
                user_id,
                seller_type,
                seller_status
            FROM seller_profiles
            WHERE id = $1
            FOR UPDATE
        `, [sellerId]);

        if (sellerResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Seller not found."
            });
        }

        const seller =
            sellerResult.rows[0];

        if (seller.seller_status === "verified") {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Seller is already verified."
            });
        }


        await client.query(`
            UPDATE seller_profiles

            SET
                seller_status = 'verified',
                verification_date = CURRENT_TIMESTAMP,
                verified_by = $1,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $2
        `, [
            req.user.id,
            sellerId
        ]);


        if (seller.seller_type === "student") {

            await client.query(`
                UPDATE student_verifications

                SET
                    verification_status = 'verified',
                    verified_at = CURRENT_TIMESTAMP

                WHERE seller_id = $1
            `, [sellerId]);

        }


        if (seller.seller_type === "business") {

            await client.query(`
                UPDATE business_verifications

                SET
                    verification_status = 'verified',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $1

                WHERE seller_id = $2
            `, [
                req.user.id,
                sellerId
            ]);

        }


        await client.query(`
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type
            )
            VALUES (
                $1,
                $2,
                $3,
                $4
            )
        `, [
            seller.user_id,
            "Seller account verified",
            "Your ReCampus seller account has been verified. You can now create product listings.",
            "seller_verification"
        ]);


        await client.query("COMMIT");


        res.json({
            success: true,
            message: "Seller verified successfully."
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Seller approval error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to verify seller."
        });

    } finally {

        client.release();
    }
});


/*
|--------------------------------------------------------------------------
| Reject seller
|--------------------------------------------------------------------------
*/

router.patch("/sellers/:sellerId/reject", async (req, res) => {

    const sellerId =
        Number(req.params.sellerId);

    const reason =
        String(
            req.body?.reason ||
            "Verification requirements were not satisfied."
        ).trim();


    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid seller ID."
        });
    }


    const client = await pool.connect();

    try {

        await client.query("BEGIN");


        const sellerResult = await client.query(`
            SELECT
                id,
                user_id,
                seller_type
            FROM seller_profiles
            WHERE id = $1
            FOR UPDATE
        `, [sellerId]);


        if (sellerResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Seller not found."
            });
        }


        const seller =
            sellerResult.rows[0];


        await client.query(`
            UPDATE seller_profiles

            SET
                seller_status = 'rejected',
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $1
        `, [sellerId]);


        if (seller.seller_type === "student") {

            await client.query(`
                UPDATE student_verifications

                SET verification_status = 'rejected'

                WHERE seller_id = $1
            `, [sellerId]);

        }


        if (seller.seller_type === "business") {

            await client.query(`
                UPDATE business_verifications

                SET
                    verification_status = 'rejected',
                    rejection_reason = $1

                WHERE seller_id = $2
            `, [
                reason,
                sellerId
            ]);

        }


        await client.query(`
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type
            )
            VALUES (
                $1,
                $2,
                $3,
                $4
            )
        `, [
            seller.user_id,
            "Seller verification update",
            `Your seller verification request was rejected. Reason: ${reason}`,
            "seller_verification"
        ]);


        await client.query("COMMIT");


        res.json({
            success: true,
            message: "Seller rejected."
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Seller rejection error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to reject seller."
        });

    } finally {

        client.release();
    }
});


module.exports = router;