const express = require("express");

const {
    getPendingSellers,
    approveSeller,
    rejectSeller
} = require("../controllers/adminSellerController");

const authMiddleware =
    require("../middleware/authMiddleware");

const adminMiddleware =
    require("../middleware/adminMiddleware");

const router = express.Router();


// Pending sellers
router.get(
    "/pending",
    authMiddleware,
    adminMiddleware,
    getPendingSellers
);


// Approve seller
router.put(
    "/:id/approve",
    authMiddleware,
    adminMiddleware,
    approveSeller
);


// Reject seller
router.put(
    "/:id/reject",
    authMiddleware,
    adminMiddleware,
    rejectSeller
);


module.exports = router;