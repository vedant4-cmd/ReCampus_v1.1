const express = require("express");
const pool = require("../config/db");
const auth = require("../middleware/authMiddleware");

const router = express.Router();


/*
========================================================
CREATE REVIEW
POST /api/reviews
========================================================

Expected body:

{
    "product_id": 1,
    "rating": 5,
    "comment": "Excellent book!"
}

Rules:
- User must be logged in
- Rating must be 1-5
- Product must exist
- Buyer must have purchased the product
- Order must be delivered
- Buyer can review a product only once
========================================================
*/

router.post("/", auth, async (req, res) => {

    try {

        const {
            product_id,
            rating,
            comment
        } = req.body;


        /*
        ------------------------------------------------
        Validate product
        ------------------------------------------------
        */

        const productId = Number(product_id);
        const numericRating = Number(rating);


        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {

            return res.status(400).json({
                message: "Valid product is required."
            });

        }


        /*
        ------------------------------------------------
        Validate rating
        ------------------------------------------------
        */

        if (
            !Number.isInteger(numericRating) ||
            numericRating < 1 ||
            numericRating > 5
        ) {

            return res.status(400).json({
                message: "Rating must be between 1 and 5."
            });

        }


        /*
        ------------------------------------------------
        Find product and seller
        ------------------------------------------------
        */

        const productResult = await pool.query(
            `
            SELECT
                id,
                seller_id,
                name
            FROM products
            WHERE id = $1
              AND status <> 'deleted'
            `,
            [productId]
        );


        if (productResult.rows.length === 0) {

            return res.status(404).json({
                message: "Product not found."
            });

        }


        const product =
            productResult.rows[0];


        /*
        ------------------------------------------------
        Check whether buyer purchased product
        ------------------------------------------------

        The order must:
        - belong to logged-in buyer
        - contain this product
        - be delivered
        ------------------------------------------------
        */

        const purchaseResult = await pool.query(
            `
            SELECT
                o.id AS order_id,
                o.order_status
            FROM orders o

            JOIN order_items oi
                ON oi.order_id = o.id

            WHERE o.buyer_id = $1
              AND oi.product_id = $2
              AND o.order_status = 'delivered'

            ORDER BY o.created_at DESC

            LIMIT 1
            `,
            [
                req.user.id,
                productId
            ]
        );


        if (purchaseResult.rows.length === 0) {

            return res.status(403).json({
                message:
                    "You can review this product only after your order has been delivered."
            });

        }


        /*
        ------------------------------------------------
        Check for existing review
        ------------------------------------------------
        */

        const existingReview =
            await pool.query(
                `
                SELECT id
                FROM reviews
                WHERE reviewer_id = $1
                  AND product_id = $2
                LIMIT 1
                `,
                [
                    req.user.id,
                    productId
                ]
            );


        if (existingReview.rows.length > 0) {

            return res.status(409).json({
                message:
                    "You have already reviewed this product."
            });

        }


        /*
        ------------------------------------------------
        Clean comment
        ------------------------------------------------
        */

        const cleanComment =
            typeof comment === "string"
                ? comment.trim()
                : null;


        /*
        ------------------------------------------------
        Insert review
        ------------------------------------------------
        */

        const result = await pool.query(
            `
            INSERT INTO reviews
            (
                reviewer_id,
                seller_id,
                product_id,
                rating,
                comment
            )
            VALUES
            ($1, $2, $3, $4, $5)

            RETURNING *
            `,
            [
                req.user.id,
                product.seller_id,
                productId,
                numericRating,
                cleanComment || null
            ]
        );


        /*
        ------------------------------------------------
        Success
        ------------------------------------------------
        */

        res.status(201).json({

            message:
                "Review submitted successfully.",

            review:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "Create review error:",
            error
        );

        res.status(500).json({
            message:
                "Failed to submit review."
        });

    }

});



/*
========================================================
GET PRODUCT REVIEWS
GET /api/reviews/product/:productId
========================================================
*/

router.get(
    "/product/:productId",
    async (req, res) => {

        try {

            const productId =
                Number(req.params.productId);


            if (
                !Number.isInteger(productId) ||
                productId <= 0
            ) {

                return res.status(400).json({
                    message:
                        "Invalid product ID."
                });

            }


            const result =
                await pool.query(
                    `
                    SELECT
                        r.id,
                        r.rating,
                        r.comment,
                        r.created_at,
                        r.reviewer_id,
                        u.name AS reviewer_name

                    FROM reviews r

                    JOIN users u
                        ON u.id = r.reviewer_id

                    WHERE r.product_id = $1

                    ORDER BY r.created_at DESC
                    `,
                    [productId]
                );


            res.json(result.rows);


        } catch (error) {

            console.error(
                "Get product reviews error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch product reviews."
            });

        }

    }
);



/*
========================================================
GET PRODUCT RATING SUMMARY
GET /api/reviews/product/:productId/summary
========================================================
*/

router.get(
    "/product/:productId/summary",
    async (req, res) => {

        try {

            const productId =
                Number(req.params.productId);


            if (
                !Number.isInteger(productId) ||
                productId <= 0
            ) {

                return res.status(400).json({
                    message:
                        "Invalid product ID."
                });

            }


            const result =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::integer AS review_count,
                        COALESCE(
                            ROUND(
                                AVG(rating)::numeric,
                                1
                            ),
                            0
                        ) AS average_rating

                    FROM reviews

                    WHERE product_id = $1
                    `,
                    [productId]
                );


            const distribution =
                await pool.query(
                    `
                    SELECT
                        rating,
                        COUNT(*)::integer AS count

                    FROM reviews

                    WHERE product_id = $1

                    GROUP BY rating

                    ORDER BY rating DESC
                    `,
                    [productId]
                );


            res.json({

                review_count:
                    result.rows[0].review_count,

                average_rating:
                    Number(
                        result.rows[0].average_rating
                    ),

                rating_distribution:
                    distribution.rows

            });


        } catch (error) {

            console.error(
                "Get rating summary error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch rating summary."
            });

        }

    }
);



/*
========================================================
GET SELLER REVIEWS
GET /api/reviews/seller/:id
========================================================
*/

router.get(
    "/seller/:id",
    async (req, res) => {

        try {

            const sellerId =
                Number(req.params.id);


            if (
                !Number.isInteger(sellerId) ||
                sellerId <= 0
            ) {

                return res.status(400).json({
                    message:
                        "Invalid seller ID."
                });

            }


            const result =
                await pool.query(
                    `
                    SELECT
                        r.*,
                        u.name AS reviewer_name

                    FROM reviews r

                    JOIN users u
                        ON u.id = r.reviewer_id

                    WHERE r.seller_id = $1

                    ORDER BY r.created_at DESC
                    `,
                    [sellerId]
                );


            res.json(result.rows);


        } catch (error) {

            console.error(
                "Get seller reviews error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch reviews."
            });

        }

    }
);


module.exports = router;