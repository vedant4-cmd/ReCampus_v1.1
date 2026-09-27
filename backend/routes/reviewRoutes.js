const express = require("express");

const authMiddleware =
    require("../middleware/authMiddleware");

const {
    createReview,
    getProductReviews
} = require("../controllers/reviewController");

const router = express.Router();

// Get reviews for a product
router.get(
    "/product/:productId",
    getProductReviews
);

// Create a review
router.post(
    "/",
    authMiddleware,
    createReview
);

module.exports = router;