const express = require("express");

const {
    getSellerOrders,
    updateSellerOrderStatus
} = require("../controllers/sellerOrderController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getSellerOrders
);

router.put(
    "/:orderId/status",
    authMiddleware,
    updateSellerOrderStatus
);

module.exports = router;