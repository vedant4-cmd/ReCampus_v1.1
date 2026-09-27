const express = require("express");
const cors = require("cors");
require("dotenv").config();

const supabase = require("./config/supabase");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const questionRoutes = require("./routes/questionRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const sellerDashboardRoutes = require("./routes/sellerDashboardRoutes");
const collegeRoutes = require("./routes/collegeRoutes");
const sellerOrderRoutes = require("./routes/sellerOrderRoutes");
const supportRoutes = require("./routes/supportRoutes");
const adminSupportRoutes = require("./routes/adminSupportRoutes");
const adminSellerRoutes = require("./routes/adminSellerRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/seller-dashboard", sellerDashboardRoutes);
app.use("/api/colleges", collegeRoutes);
app.use("/api/seller-orders", sellerOrderRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/admin/sellers", adminSellerRoutes);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "ReCampus API is running 🚀"
    });
});

app.get("/api/test-db", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("colleges")
            .select("*");

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            message: "Supabase connected successfully!",
            colleges: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const authMiddleware = require("./middleware/authMiddleware");

app.get("/api/protected", authMiddleware, (req, res) => {
    res.json({
        success: true,
        message: "You accessed a protected route!",
        user: req.user
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`ReCampus API running on port ${PORT}`);
});
