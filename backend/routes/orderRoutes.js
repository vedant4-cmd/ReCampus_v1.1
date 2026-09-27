const express = require("express");

const {
    createOrder,
    getMyOrders,
    getOrderById,
    verifyPayment
} = require("../controllers/orderController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// Get logged-in user's orders
router.get("/my-orders", authMiddleware, getMyOrders);


// Get one specific order
router.get("/:orderId", authMiddleware, getOrderById);


// Create order
router.post("/", authMiddleware, createOrder);


// Verify Razorpay payment
router.post("/verify-payment", authMiddleware, verifyPayment);


module.exports = router;