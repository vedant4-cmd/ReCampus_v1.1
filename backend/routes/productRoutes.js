const express = require("express");
const multer = require("multer");

const {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    uploadProductImage
} = require("../controllers/productController");

const authMiddleware =
    require("../middleware/authMiddleware");

const sellerVerificationMiddleware =
    require("../middleware/sellerVerificationMiddleware");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    }
});

// Public
router.get("/", getProducts);
router.get("/:id", getProductById);

// Protected

router.post(
    "/",
    authMiddleware,
    sellerVerificationMiddleware,
    createProduct
);
router.put("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, deleteProduct);
router.post(
    "/upload-image",
    authMiddleware,
    upload.single("image"),
    uploadProductImage
);

module.exports = router;