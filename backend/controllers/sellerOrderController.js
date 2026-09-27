const supabase = require("../config/supabase");
function formatOrderStatus(status) {
    return status
        .replace("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

const getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user.userId;

        const { data, error } = await supabase
            .from("order_items")
            .select(`
                id,
                order_id,
                product_id,
                quantity,
                price,
                created_at,
                products (
                    id,
                    title
                ),
                orders (
                    id,
                    buyer_id,
                    total_amount,
                    payment_status,
                    order_status,
                    created_at
                )
            `)
            .eq("seller_id", sellerId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Get seller orders error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load seller orders"
            });
        }

        res.json({
            success: true,
            orders: data || []
        });

    } catch (error) {
        console.error("Seller orders error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


const updateSellerOrderStatus = async (req, res) => {
    try {
        const sellerId = req.user.userId;
        const orderId = req.params.orderId;
        const { order_status } = req.body;

        const allowedStatuses = [
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled"
        ];

        if (!allowedStatuses.includes(order_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status"
            });
        }

        // Make sure this order actually contains
        // a product belonging to this seller.
        const { data: sellerItem, error: sellerItemError } =
            await supabase
                .from("order_items")
                .select("id")
                .eq("order_id", orderId)
                .eq("seller_id", sellerId)
                .limit(1);

        if (sellerItemError) {
            console.error("Seller order check error:", sellerItemError);

            return res.status(500).json({
                success: false,
                message: "Failed to verify seller order"
            });
        }

        if (!sellerItem || sellerItem.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this order"
            });
        }

        const { data, error } = await supabase
            .from("orders")
            .update({
                order_status
            })
            .eq("id", orderId)
            .select()
            .single();

        if (error) {
            console.error("Update seller order error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to update order status"
            });
        }

        await supabase
            .from("notifications")
            .insert({
                user_id: data.buyer_id,
                title: "Order Status Updated",
                message: `Your order #${data.id} is now ${formatOrderStatus(order_status)}.`,
                type: "order_update",
                is_read: false
            });

        res.json({
            success: true,
            message: "Order status updated successfully",
            order: data
        });

    } catch (error) {
        console.error("Seller order status error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    getSellerOrders,
    updateSellerOrderStatus
};