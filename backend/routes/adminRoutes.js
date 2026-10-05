const express = require("express");

const {
    getDashboardStats,
    getCommissionData
} = require("../controllers/adminController");

const authMiddleware =
    require("../middleware/authMiddleware");

const adminMiddleware =
    require("../middleware/adminMiddleware");

const router = express.Router();


// =====================================================
// ADMIN DASHBOARD STATISTICS
// =====================================================

router.get(
    "/stats",
    authMiddleware,
    adminMiddleware,
    getDashboardStats
);


// =====================================================
// ADMIN COMMISSION DATA
// =====================================================

router.get(
    "/commission",
    authMiddleware,
    adminMiddleware,
    getCommissionData
);


module.exports = router;