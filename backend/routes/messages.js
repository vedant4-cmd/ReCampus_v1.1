const express = require("express");
const pool = require("../config/db");
const auth = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// SEND MESSAGE
// POST /api/messages
// =====================================================

router.post("/", auth, async (req, res) => {

    try {

        const {
            receiver_id,
            product_id,
            message
        } = req.body;


        const receiverId = Number(receiver_id);

        const productId =
            product_id !== undefined &&
            product_id !== null &&
            product_id !== ""
                ? Number(product_id)
                : null;


        const cleanMessage =
            typeof message === "string"
                ? message.trim()
                : "";


        if (
            !Number.isInteger(receiverId) ||
            receiverId <= 0
        ) {

            return res.status(400).json({
                message: "Valid receiver is required."
            });

        }


        if (receiverId === req.user.id) {

            return res.status(400).json({
                message: "You cannot message yourself."
            });

        }


        if (!cleanMessage) {

            return res.status(400).json({
                message: "Message cannot be empty."
            });

        }


        if (cleanMessage.length > 2000) {

            return res.status(400).json({
                message: "Message cannot exceed 2000 characters."
            });

        }


        // Check receiver exists
        const receiverResult =
            await pool.query(
                `
                SELECT id, name, role
                FROM users
                WHERE id = $1
                `,
                [receiverId]
            );


        if (receiverResult.rows.length === 0) {

            return res.status(404).json({
                message: "Receiver not found."
            });

        }


        // If product_id was supplied,
        // verify that the product exists.
        if (productId !== null) {

            if (
                !Number.isInteger(productId) ||
                productId <= 0
            ) {

                return res.status(400).json({
                    message: "Invalid product."
                });

            }


            const productResult =
                await pool.query(
                    `
                    SELECT id
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

        }


        const result =
            await pool.query(
                `
                INSERT INTO messages
                (
                    sender_id,
                    receiver_id,
                    product_id,
                    message
                )
                VALUES
                ($1, $2, $3, $4)
                RETURNING
                    id,
                    sender_id,
                    receiver_id,
                    product_id,
                    message,
                    is_read,
                    created_at
                `,
                [
                    req.user.id,
                    receiverId,
                    productId,
                    cleanMessage
                ]
            );


        // Create notification for receiver
        await pool.query(
            `
            INSERT INTO notifications
            (
                user_id,
                title,
                message,
                type
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4
            )
            `,
            [
                receiverId,
                "New Message",
                `You received a new message from ${req.user.name || "a user"}.`,
                "message"
            ]
        );


        res.status(201).json({

            message: "Message sent successfully.",

            data: result.rows[0]

        });


    } catch (error) {

        console.error(
            "Send message error:",
            error
        );

        res.status(500).json({
            message: "Failed to send message."
        });

    }

});


// =====================================================
// GET ALL CONVERSATIONS
// GET /api/messages/conversations
// =====================================================

router.get(
    "/conversations",
    auth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    WITH conversation_messages AS (

                        SELECT
                            CASE
                                WHEN sender_id = $1
                                    THEN receiver_id
                                ELSE sender_id
                            END AS other_user_id,

                            product_id,

                            MAX(id) AS latest_message_id

                        FROM messages

                        WHERE
                            sender_id = $1
                            OR receiver_id = $1

                        GROUP BY
                            CASE
                                WHEN sender_id = $1
                                    THEN receiver_id
                                ELSE sender_id
                            END,
                            product_id
                    )

                    SELECT

                        cm.other_user_id,

                        u.name AS other_user_name,

                        u.role AS other_user_role,

                        cm.product_id,

                        p.name AS product_name,

                        m.message AS latest_message,

                        m.created_at AS latest_message_at,

                        (
                            SELECT COUNT(*)
                            FROM messages unread
                            WHERE
                                unread.sender_id = cm.other_user_id
                                AND unread.receiver_id = $1
                                AND unread.product_id IS NOT DISTINCT FROM cm.product_id
                                AND unread.is_read = FALSE
                        ) AS unread_count

                    FROM conversation_messages cm

                    JOIN users u
                        ON u.id = cm.other_user_id

                    LEFT JOIN products p
                        ON p.id = cm.product_id

                    JOIN messages m
                        ON m.id = cm.latest_message_id

                    ORDER BY
                        m.created_at DESC
                    `,
                    [req.user.id]
                );


            res.json(result.rows);


        } catch (error) {

            console.error(
                "Get conversations error:",
                error
            );

            res.status(500).json({
                message: "Failed to load conversations."
            });

        }

    }
);


// =====================================================
// GET CONVERSATION
// GET /api/messages/:userId
// =====================================================

router.get(
    "/:userId",
    auth,
    async (req, res) => {

        try {

            const otherUserId =
                Number(req.params.userId);


            if (
                !Number.isInteger(otherUserId) ||
                otherUserId <= 0
            ) {

                return res.status(400).json({
                    message: "Invalid user ID."
                });

            }


            if (otherUserId === req.user.id) {

                return res.status(400).json({
                    message: "Invalid conversation."
                });

            }


            const result =
                await pool.query(
                    `
                    SELECT

                        m.id,

                        m.sender_id,

                        m.receiver_id,

                        m.product_id,

                        m.message,

                        m.is_read,

                        m.created_at,

                        sender.name AS sender_name,

                        receiver.name AS receiver_name,

                        p.name AS product_name

                    FROM messages m

                    JOIN users sender
                        ON sender.id = m.sender_id

                    JOIN users receiver
                        ON receiver.id = m.receiver_id

                    LEFT JOIN products p
                        ON p.id = m.product_id

                    WHERE
                        (
                            m.sender_id = $1
                            AND m.receiver_id = $2
                        )
                        OR
                        (
                            m.sender_id = $2
                            AND m.receiver_id = $1
                        )

                    ORDER BY
                        m.created_at ASC
                    `,
                    [
                        req.user.id,
                        otherUserId
                    ]
                );


            res.json(result.rows);


        } catch (error) {

            console.error(
                "Get conversation error:",
                error
            );

            res.status(500).json({
                message: "Failed to load conversation."
            });

        }

    }
);


// =====================================================
// MARK CONVERSATION AS READ
// PATCH /api/messages/:userId/read
// =====================================================

router.patch(
    "/:userId/read",
    auth,
    async (req, res) => {

        try {

            const otherUserId =
                Number(req.params.userId);


            if (
                !Number.isInteger(otherUserId) ||
                otherUserId <= 0
            ) {

                return res.status(400).json({
                    message: "Invalid user ID."
                });

            }


            await pool.query(
                `
                UPDATE messages

                SET is_read = TRUE

                WHERE
                    sender_id = $1
                    AND receiver_id = $2
                    AND is_read = FALSE
                `,
                [
                    otherUserId,
                    req.user.id
                ]
            );


            res.json({
                message: "Messages marked as read."
            });


        } catch (error) {

            console.error(
                "Mark messages read error:",
                error
            );

            res.status(500).json({
                message: "Failed to update messages."
            });

        }

    }
);


module.exports = router;