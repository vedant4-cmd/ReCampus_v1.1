const express = require("express");

const {
    getSellerDashboard
} = require("../controllers/sellerDashboardController");

const authMiddleware =
    require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getSellerDashboard
);

module.exports = router;