const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// =====================================================
// CREATE RAZORPAY ORDER
// =====================================================

router.post("/create/:orderId", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `
      SELECT
        id,
        buyer_id,
        total_amount,
        payment_status,
        order_status
      FROM orders
      WHERE id = $1
        AND buyer_id = $2
      FOR UPDATE
      `,
      [req.params.orderId, req.user.id]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Order not found",
      });
    }

    const order = orderResult.rows[0];

    if (order.payment_status === "paid") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "This order has already been paid",
      });
    }

    if (order.order_status === "cancelled") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "This order has been cancelled",
      });
    }

    const amountInPaise = Math.round(
      Number(order.total_amount) * 100
    );

    if (!amountInPaise || amountInPaise <= 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Invalid order amount",
      });
    }

    // Check whether a Razorpay order already exists
    const existingPayment = await client.query(
      `
      SELECT
        id,
        gateway_order_id,
        amount,
        status
      FROM payments
      WHERE order_id = $1
      `,
      [order.id]
    );

    let razorpayOrder;

    if (
      existingPayment.rows.length > 0 &&
      existingPayment.rows[0].gateway_order_id
    ) {
      razorpayOrder = {
        id: existingPayment.rows[0].gateway_order_id,
        amount: amountInPaise,
        currency: "INR",
      };
    } else {
      razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `RECAMPUS_${order.id}`,
        notes: {
          recampus_order_id: String(order.id),
          buyer_id: String(req.user.id),
        },
      });
    }

    if (existingPayment.rows.length === 0) {
      await client.query(
        `
        INSERT INTO payments
        (
          order_id,
          payment_gateway,
          gateway_order_id,
          amount,
          currency,
          status
        )
        VALUES
        ($1, 'razorpay', $2, $3, 'INR', 'pending')
        `,
        [
          order.id,
          razorpayOrder.id,
          order.total_amount,
        ]
      );
    } else {
      await client.query(
        `
        UPDATE payments
        SET
          gateway_order_id = $1,
          amount = $2,
          status = 'pending'
        WHERE order_id = $3
        `,
        [
          razorpayOrder.id,
          order.total_amount,
          order.id,
        ]
      );
    }

    await client.query(
      `
      UPDATE orders
      SET payment_status = 'processing'
      WHERE id = $1
      `,
      [order.id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Razorpay order creation error:", error);

    res.status(500).json({
      message: "Failed to create Razorpay payment order",
    });
  } finally {
    client.release();
  }
});


// =====================================================
// VERIFY PAYMENT
// =====================================================

router.post("/verify", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        message: "Missing Razorpay payment details",
      });
    }

    await client.query("BEGIN");

    // Find our local order using the Razorpay order ID
    const orderResult = await client.query(
      `
      SELECT
        o.id,
        o.buyer_id,
        o.total_amount,
        o.payment_status,
        o.order_status,
        p.id AS payment_id
      FROM payments p
      JOIN orders o
        ON o.id = p.order_id
      WHERE p.gateway_order_id = $1
        AND o.buyer_id = $2
      FOR UPDATE
      `,
      [razorpay_order_id, req.user.id]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Payment order not found",
      });
    }

    const order = orderResult.rows[0];

    // Verify signature
    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    if (
      generatedSignature !== razorpay_signature
    ) {
      await client.query(
        `
        UPDATE payments
        SET
          status = 'failed'
        WHERE id = $1
        `,
        [order.payment_id]
      );

      await client.query(
        `
        UPDATE orders
        SET payment_status = 'failed'
        WHERE id = $1
        `,
        [order.id]
      );

      await client.query("COMMIT");

      return res.status(400).json({
        message: "Payment signature verification failed",
      });
    }

    // Prevent duplicate processing
    if (order.payment_status === "paid") {
      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Payment was already verified",
        orderId: order.id,
      });
    }

    // Get all order items
    const itemsResult = await client.query(
      `
      SELECT
        oi.id,
        oi.product_id,
        oi.seller_id,
        oi.quantity
      FROM order_items oi
      WHERE oi.order_id = $1
      `,
      [order.id]
    );

    // Finalize inventory
    for (const item of itemsResult.rows) {
      const inventoryResult = await client.query(
        `
        SELECT
          quantity,
          reserved_quantity
        FROM inventory
        WHERE product_id = $1
        FOR UPDATE
        `,
        [item.product_id]
      );

      if (inventoryResult.rows.length === 0) {
        throw new Error(
          `Inventory not found for product ${item.product_id}`
        );
      }

      const inventory = inventoryResult.rows[0];

      if (
        Number(inventory.quantity) <
        Number(item.quantity)
      ) {
        throw new Error(
          `Insufficient inventory for product ${item.product_id}`
        );
      }

      const newQuantity =
        Number(inventory.quantity) -
        Number(item.quantity);

      const newReservedQuantity = Math.max(
        0,
        Number(inventory.reserved_quantity) -
          Number(item.quantity)
      );

      await client.query(
        `
        UPDATE inventory
        SET
          quantity = $1,
          reserved_quantity = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $3
        `,
        [
          newQuantity,
          newReservedQuantity,
          item.product_id,
        ]
      );

      await client.query(
        `
        INSERT INTO inventory_movements
        (
          product_id,
          seller_id,
          movement_type,
          quantity,
          previous_quantity,
          new_quantity,
          note
        )
        VALUES
        (
          $1,
          $2,
          'sale',
          $3,
          $4,
          $5,
          $6
        )
        `,
        [
          item.product_id,
          item.seller_id,
          item.quantity,
          inventory.quantity,
          newQuantity,
          `Order #${order.id} payment successful`,
        ]
      );

      // Automatically mark product out of stock
      if (newQuantity <= 0) {
        await client.query(
          `
          UPDATE products
          SET
            status = 'out_of_stock',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          [item.product_id]
        );
      }

      // Seller notification
      await client.query(
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
          item.seller_id,
          "Payment Received",
          `Payment received for Order #${order.id}.`,
          "order",
        ]
      );
    }

    // Update payment
    await client.query(
      `
      UPDATE payments
      SET
        gateway_payment_id = $1,
        status = 'success',
        paid_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [
        razorpay_payment_id,
        order.payment_id,
      ]
    );

    // Update order
    await client.query(
      `
      UPDATE orders
      SET
        payment_status = 'paid',
        order_status = 'confirmed'
      WHERE id = $1
      `,
      [order.id]
    );

    // Buyer notification
    await client.query(
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
        order.buyer_id,
        "Payment Successful",
        `Payment for Order #${order.id} was successful.`,
        "payment",
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Payment verified successfully",
      orderId: order.id,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Payment verification error:", error);

    res.status(500).json({
      message:
        "Payment verification failed. Please contact support if money was deducted.",
    });
  } finally {
    client.release();
  }
});


// =====================================================
// PAYMENT FAILURE
// =====================================================

router.post("/failed", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
    } = req.body;

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
      SELECT
        o.id,
        o.buyer_id
      FROM payments p
      JOIN orders o
        ON o.id = p.order_id
      WHERE p.gateway_order_id = $1
        AND o.buyer_id = $2
      FOR UPDATE
      `,
      [razorpay_order_id, req.user.id]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Payment order not found",
      });
    }

    const order = orderResult.rows[0];

    await client.query(
      `
      UPDATE payments
      SET
        gateway_payment_id = COALESCE($1, gateway_payment_id),
        status = 'failed'
      WHERE gateway_order_id = $2
      `,
      [
        razorpay_payment_id || null,
        razorpay_order_id,
      ]
    );

    await client.query(
      `
      UPDATE orders
      SET payment_status = 'failed'
      WHERE id = $1
      `,
      [order.id]
    );

    // Release reserved inventory
    const items = await client.query(
      `
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = $1
      `,
      [order.id]
    );

    for (const item of items.rows) {
      await client.query(
        `
        UPDATE inventory
        SET
          reserved_quantity =
            GREATEST(
              0,
              reserved_quantity - $1
            ),
          updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2
        `,
        [
          item.quantity,
          item.product_id,
        ]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Payment marked as failed",
      orderId: order.id,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Payment failure handling error:", error);

    res.status(500).json({
      message: "Failed to process payment failure",
    });
  } finally {
    client.release();
  }
});


module.exports = router;