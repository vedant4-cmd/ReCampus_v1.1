const supabase = require("../config/supabase");

const getSellerDashboard = async (req, res) => {
    try {
        const sellerId = req.user.userId;

        // Seller's products
        const { data: products, error: productsError } =
            await supabase
                .from("products")
                .select(`
                    id,
                    title,
                    price,
                    stock,
                    status,
                    category,
                    created_at
                `)
                .eq("seller_id", sellerId)
                .order("created_at", { ascending: false });

        if (productsError) {
            return res.status(500).json({
                success: false,
                message: productsError.message
            });
        }

        // Seller's order items
        const { data: orderItems, error: orderItemsError } =
            await supabase
                .from("order_items")
                .select(`
                    id,
                    order_id,
                    product_id,
                    quantity,
                    price,
                    orders (
                        id,
                        payment_status,
                        order_status,
                        created_at
                    ),
                    products (
                        id,
                        title
                    )
                `)
                .eq("seller_id", sellerId)
                .order("created_at", { ascending: false });

        if (orderItemsError) {
            return res.status(500).json({
                success: false,
                message: orderItemsError.message
            });
        }

        // Only paid orders count as sales
        const paidItems = (orderItems || []).filter(
            item => item.orders?.payment_status === "paid"
        );

        const totalSales = paidItems.reduce(
            (sum, item) =>
                sum +
                Number(item.price || 0) *
                Number(item.quantity || 0),
            0
        );

        const productsSold = paidItems.reduce(
            (sum, item) =>
                sum + Number(item.quantity || 0),
            0
        );

        const uniqueOrders = [
            ...new Set(
                paidItems.map(item => item.order_id)
            )
        ];

        res.json({
            success: true,

            stats: {
                totalProducts: products.length,
                activeProducts: products.filter(
                    product => product.status === "active"
                ).length,
                totalOrders: uniqueOrders.length,
                productsSold,
                totalSales
            },

            products,

            orders: orderItems || []
        });

    } catch (error) {

        console.error(
            "Seller dashboard error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    getSellerDashboard
};