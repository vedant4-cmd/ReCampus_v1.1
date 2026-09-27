const express = require("express");

const {
    getSellerProfile
} = require("../controllers/sellerController");

const router = express.Router();

// Get seller profile
router.get(
    "/:sellerId",
    getSellerProfile
);

module.exports = router;