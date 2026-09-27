const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
========================================================
CREATE ORDER
POST /api/orders
========================================================
*/

router.post("/", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
        const { items, shipping_address_id } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "At least one product is required."
            });
        }

        for (const item of items) {
            const productId = Number(item.product_id);
            const quantity = Number(item.quantity);

            if (
                !Number.isInteger(productId) ||
                productId <= 0 ||
                !Number.isInteger(quantity) ||
                quantity <= 0
            ) {
                return res.status(400).json({
                    message: "Valid product and quantity are required."
                });
            }
        }

        await client.query("BEGIN");

        let totalAmount = 0;
        const validatedItems = [];

        for (const item of items) {
            const productId = Number(item.product_id);
            const quantity = Number(item.quantity);

            const productResult = await client.query(
                `
                SELECT
                    p.id,
                    p.name,
                    p.price,
                    p.seller_id,
                    p.status,
                    i.quantity,
                    i.reserved_quantity
                FROM products p
                JOIN inventory i
                    ON i.product_id = p.id
                WHERE p.id = $1
                FOR UPDATE
                `,
                [productId]
            );

            if (productResult.rows.length === 0) {
                throw new Error(`Product ${productId} not found.`);
            }

            const product = productResult.rows[0];

            if (product.status !== "active") {
                throw new Error(
                    `"${product.name}" is not currently available.`
                );
            }

            const availableQuantity =
                Number(product.quantity) -
                Number(product.reserved_quantity);

            if (availableQuantity < quantity) {
                throw new Error(
                    `"${product.name}" does not have enough stock.`
                );
            }

            const subtotal =
                Number(product.price) * quantity;

            totalAmount += subtotal;

            validatedItems.push({
                productId,
                sellerId: product.seller_id,
                name: product.name,
                price: Number(product.price),
                quantity,
                subtotal
            });
        }

        const orderResult = await client.query(
            `
            INSERT INTO orders (
                buyer_id,
                total_amount,
                payment_status,
                order_status,
                shipping_address_id
            )
            VALUES ($1, $2, 'pending', 'placed', $3)
            RETURNING id, buyer_id, total_amount,
                      payment_status, order_status,
                      created_at
            `,
            [
                req.user.id,
                totalAmount,
                shipping_address_id || null
            ]
        );

        const order = orderResult.rows[0];

        for (const item of validatedItems) {
            await client.query(
                `
                INSERT INTO order_items (
                    order_id,
                    product_id,
                    seller_id,
                    price,
                    quantity,
                    subtotal
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                `,
                [
                    order.id,
                    item.productId,
                    item.sellerId,
                    item.price,
                    item.quantity,
                    item.subtotal
                ]
            );

            await client.query(
                `
                UPDATE inventory
                SET reserved_quantity =
                    reserved_quantity + $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = $2
                `,
                [
                    item.quantity,
                    item.productId
                ]
            );

            await client.query(
                `
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    item.sellerId,
                    "New Order",
                    `You received a new order for ${item.name}. Order #${order.id}.`,
                    "order"
                ]
            );
        }

        await client.query(
            `
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type
            )
            VALUES ($1, $2, $3, $4)
            `,
            [
                req.user.id,
                "Order Created",
                `Your order #${order.id} has been created. Complete payment to confirm it.`,
                "order"
            ]
        );

        await client.query(
            `
            INSERT INTO payments (
                order_id,
                payment_gateway,
                amount,
                currency,
                status
            )
            VALUES ($1, $2, $3, 'INR', 'pending')
            ON CONFLICT (order_id)
            DO UPDATE SET
                amount = EXCLUDED.amount,
                status = 'pending'
            `,
            [
                order.id,
                "razorpay",
                totalAmount
            ]
        );

        await client.query("COMMIT");

        res.status(201).json({
            message: "Order created successfully.",
            id: order.id,
            orderId: order.id,
            totalAmount,
            paymentStatus: "pending",
            orderStatus: "placed"
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Create order error:", error);

        res.status(400).json({
            message: error.message || "Unable to create order."
        });

    } finally {
        client.release();
    }
});


/*
========================================================
BUYER ORDER HISTORY
GET /api/orders/my
========================================================
*/

router.get("/my", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                o.id,
                o.total_amount,
                o.payment_status,
                o.order_status,
                o.created_at,
                COUNT(oi.id) AS item_count
            FROM orders o
            LEFT JOIN order_items oi
                ON oi.order_id = o.id
            WHERE o.buyer_id = $1
            GROUP BY o.id
            ORDER BY o.created_at DESC
            `,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Get buyer orders error:", error);

        res.status(500).json({
            message: "Unable to load orders."
        });
    }
});


/*
========================================================
ORDER DETAILS
GET /api/orders/:id
========================================================
*/

router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId)) {
            return res.status(400).json({
                message: "Invalid order ID."
            });
        }

        const orderResult = await pool.query(
            `
            SELECT
                o.id,
                o.buyer_id,
                o.total_amount,
                o.payment_status,
                o.order_status,
                o.shipping_address_id,
                o.created_at
            FROM orders o
            WHERE o.id = $1
              AND o.buyer_id = $2
            `,
            [
                orderId,
                req.user.id
            ]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                message: "Order not found."
            });
        }

        const itemsResult = await pool.query(
            `
            SELECT
                oi.id,
                oi.product_id,
                oi.seller_id,
                oi.price,
                oi.quantity,
                oi.subtotal,
                p.name,
                p.slug
            FROM order_items oi
            JOIN products p
                ON p.id = oi.product_id
            WHERE oi.order_id = $1
            ORDER BY oi.id
            `,
            [orderId]
        );

        const paymentResult = await pool.query(
            `
            SELECT
                id,
                payment_gateway,
                gateway_order_id,
                gateway_payment_id,
                amount,
                currency,
                status,
                paid_at,
                created_at
            FROM payments
            WHERE order_id = $1
            `,
            [orderId]
        );

        res.json({
            order: orderResult.rows[0],
            items: itemsResult.rows,
            payment: paymentResult.rows[0] || null
        });

    } catch (error) {
        console.error("Get order details error:", error);

        res.status(500).json({
            message: "Unable to load order."
        });
    }
});


/*
========================================================
SELLER ORDERS
GET /api/orders/seller/orders
========================================================
*/

/*
========================================================
SELLER ORDERS
GET /api/orders/seller/orders
========================================================
*/

router.get(
    "/seller/orders",
    authMiddleware,
    async (req, res) => {
        try {

            /*
            ------------------------------------------------
            Get seller's order items
            ------------------------------------------------
            */

            const ordersResult = await pool.query(
                `
                SELECT
                    o.id,
                    o.total_amount,
                    o.payment_status,
                    o.order_status,
                    o.created_at,

                    oi.product_id,
                    oi.quantity,
                    oi.price,
                    oi.subtotal,

                    p.name AS product_name,

                    u.name AS buyer_name,
                    u.email AS buyer_email

                FROM orders o

                JOIN order_items oi
                    ON oi.order_id = o.id

                JOIN products p
                    ON p.id = oi.product_id

                JOIN users u
                    ON u.id = o.buyer_id

                WHERE oi.seller_id = $1

                ORDER BY o.created_at DESC
                `,
                [req.user.id]
            );


            /*
            ------------------------------------------------
            Calculate seller statistics
            ------------------------------------------------

            Revenue is counted only for successfully paid
            orders.

            This prevents unpaid/failed orders from appearing
            as seller revenue.
            ------------------------------------------------
            */

            let orderCount = 0;
            let revenue = 0;

            const uniqueOrders = new Set();


            ordersResult.rows.forEach(order => {

                if (order.payment_status === "paid") {

                    uniqueOrders.add(order.id);

                    revenue += Number(
                        order.subtotal || 0
                    );

                }

            });


            orderCount = uniqueOrders.size;


            /*
            ------------------------------------------------
            Send response
            ------------------------------------------------
            */

            res.json({
                orders: ordersResult.rows,

                stats: {
                    orders: orderCount,
                    revenue: Number(
                        revenue.toFixed(2)
                    )
                }
            });


        } catch (error) {

            console.error(
                "Get seller orders error:",
                error
            );

            res.status(500).json({
                message:
                    "Unable to load seller orders."
            });

        }
    }
);


/*
========================================================
SELLER UPDATE ORDER STATUS
PATCH /api/orders/seller/:orderId/status
========================================================

Allowed statuses:

confirmed
processing
shipped
delivered

Only the seller who owns the product can update it.

Payment must already be successful.
========================================================
*/

router.patch(
    "/seller/:orderId/status",
    authMiddleware,
    async (req, res) => {

        const client = await pool.connect();

        try {
            const orderId = Number(req.params.orderId);
            const { status } = req.body;

            const allowedStatuses = [
                "confirmed",
                "processing",
                "shipped",
                "delivered"
            ];

            if (!Number.isInteger(orderId)) {
                return res.status(400).json({
                    message: "Invalid order ID."
                });
            }

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    message: "Invalid order status."
                });
            }

            await client.query("BEGIN");

            /*
            Check that this seller owns at least one item
            in the order and that payment is successful.
            */

            const orderResult = await client.query(
                `
                SELECT
                    o.id,
                    o.buyer_id,
                    o.payment_status,
                    o.order_status
                FROM orders o
                JOIN order_items oi
                    ON oi.order_id = o.id
                WHERE o.id = $1
                  AND oi.seller_id = $2
                LIMIT 1
                `,
                [
                    orderId,
                    req.user.id
                ]
            );

            if (orderResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: "Order not found or you are not the seller."
                });
            }

            const order = orderResult.rows[0];

            if (order.payment_status !== "paid") {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "Order payment has not been completed."
                });
            }

            /*
            Prevent moving backwards.
            */

            const statusOrder = {
                confirmed: 1,
                processing: 2,
                shipped: 3,
                delivered: 4
            };

            const currentStatus = order.order_status;

            /*
            "placed" can become confirmed after payment.
            */

            if (
                currentStatus !== "placed" &&
                statusOrder[currentStatus] &&
                statusOrder[status] < statusOrder[currentStatus]
            ) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "Order status cannot move backwards."
                });
            }

            await client.query(
                `
                UPDATE orders
                SET order_status = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                `,
                [
                    status,
                    orderId
                ]
            );

            /*
            Buyer notification
            */

            const statusMessages = {
                confirmed:
                    `Your order #${orderId} has been confirmed by the seller.`,

                processing:
                    `Your order #${orderId} is now being processed.`,

                shipped:
                    `Your order #${orderId} has been shipped.`,

                delivered:
                    `Your order #${orderId} has been delivered.`
            };

            await client.query(
                `
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    order.buyer_id,
                    "Order Update",
                    statusMessages[status],
                    "order"
                ]
            );

            await client.query("COMMIT");

            res.json({
                message: "Order status updated successfully.",
                orderId,
                status
            });

        } catch (error) {

            await client.query("ROLLBACK");

            console.error(
                "Update seller order status error:",
                error
            );

            res.status(500).json({
                message: "Unable to update order status."
            });

        } finally {
            client.release();
        }
    }
);


module.exports = router;