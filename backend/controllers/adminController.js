const supabase = require("../config/supabase");

const getDashboardStats = async (req, res) => {
    try {
        const [
            usersResult,
            productsResult,
            ordersResult,
            paidOrdersResult
        ] = await Promise.all([
            supabase
                .from("users")
                .select("id", { count: "exact", head: true }),

            supabase
                .from("products")
                .select("id", { count: "exact", head: true }),

            supabase
                .from("orders")
                .select("id", { count: "exact", head: true }),

            supabase
                .from("orders")
                .select("total_amount")
                .eq("payment_status", "paid")
        ]);

        if (
            usersResult.error ||
            productsResult.error ||
            ordersResult.error ||
            paidOrdersResult.error
        ) {
            return res.status(500).json({
                success: false,
                message: "Failed to load dashboard statistics"
            });
        }

        const totalRevenue =
            (paidOrdersResult.data || []).reduce(
                (sum, order) =>
                    sum + Number(order.total_amount || 0),
                0
            );

        res.json({
            success: true,
            stats: {
                totalUsers: usersResult.count || 0,
                totalProducts: productsResult.count || 0,
                totalOrders: ordersResult.count || 0,
                totalRevenue
            }
        });

    } catch (error) {
        console.error("Admin dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    getDashboardStats
};