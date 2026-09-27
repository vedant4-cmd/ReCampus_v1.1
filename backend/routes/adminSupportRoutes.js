const express = require("express");

const {
    getAllSupportRequests,
    updateSupportRequest,
    processRefund,
    processReplacement
} = require("../controllers/adminSupportController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    adminMiddleware,
    getAllSupportRequests
);

router.put(
    "/:id",
    authMiddleware,
    adminMiddleware,
    updateSupportRequest
);

router.post(
    "/:id/refund",
    authMiddleware,
    adminMiddleware,
    processRefund
);

router.post(
    "/:id/replacement",
    authMiddleware,
    adminMiddleware,
    processReplacement
);

module.exports = router;