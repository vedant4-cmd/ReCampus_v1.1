const express = require("express");

const authMiddleware =
    require("../middleware/authMiddleware");

const {
    addToWishlist,
    removeFromWishlist,
    getMyWishlist
} = require("../controllers/wishlistController");

const router = express.Router();

// Get my wishlist
router.get(
    "/",
    authMiddleware,
    getMyWishlist
);

// Add product to wishlist
router.post(
    "/",
    authMiddleware,
    addToWishlist
);

// Remove product from wishlist
router.delete(
    "/:productId",
    authMiddleware,
    removeFromWishlist
);

module.exports = router;