const express = require("express");

const {
    createSupportRequest,
    getMySupportRequests,
    getSupportOrders
} = require("../controllers/supportController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    createSupportRequest
);

router.get(
    "/my",
    authMiddleware,
    getMySupportRequests
);

router.get(
    "/orders",
    authMiddleware,
    getSupportOrders
);

module.exports = router;