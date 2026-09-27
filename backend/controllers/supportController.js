const supabase = require("../config/supabase");

// CREATE SUPPORT / REFUND / REPLACEMENT REQUEST
const createSupportRequest = async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            order_id,
            product_id,
            type,
            reason,
            description
        } = req.body;

        const allowedTypes = [
            "support",
            "refund",
            "replacement"
        ];

        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request type"
            });
        }

        if (!reason || !description) {
            return res.status(400).json({
                success: false,
                message: "Reason and description are required"
            });
        }

        // Verify order belongs to logged-in buyer
        if (order_id) {
            const { data: order, error: orderError } =
                await supabase
                    .from("orders")
                    .select("id, buyer_id, payment_status")
                    .eq("id", order_id)
                    .eq("buyer_id", userId)
                    .single();

            if (orderError || !order) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to use this order"
                });
            }

            // Refund/replacement should be for a paid order
            if (
                (type === "refund" || type === "replacement") &&
                order.payment_status !== "paid"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "This order is not eligible for this request"
                });
            }
        }

        // If product_id is supplied, verify it belongs to the order
        if (product_id && order_id) {
            const { data: item, error: itemError } =
                await supabase
                    .from("order_items")
                    .select("id")
                    .eq("order_id", order_id)
                    .eq("product_id", product_id)
                    .single();

            if (itemError || !item) {
                return res.status(400).json({
                    success: false,
                    message: "Product does not belong to this order"
                });
            }
        }

        const { data, error } = await supabase
            .from("support_requests")
            .insert({
                user_id: userId,
                order_id: order_id || null,
                product_id: product_id || null,
                type,
                reason,
                description,
                status: "open"
            })
            .select()
            .single();

        if (error) {
            console.error(
                "Create support request error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to create request"
            });
        }

        res.status(201).json({
            success: true,
            message: "Request submitted successfully",
            request: data
        });

    } catch (error) {
        console.error(
            "Support request error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// GET MY SUPPORT REQUESTS
const getMySupportRequests = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from("support_requests")
            .select(`
                id,
                order_id,
                product_id,
                type,
                reason,
                description,
                status,
                admin_response,
                created_at,
                updated_at
            `)
            .eq("user_id", userId)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error(
                "Get support requests error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load requests"
            });
        }

        res.json({
            success: true,
            requests: data || []
        });

    } catch (error) {
        console.error(
            "Support requests error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// GET BUYER ORDERS FOR SUPPORT
const getSupportOrders = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from("orders")
            .select(`
                id,
                total_amount,
                payment_status,
                order_status,
                created_at,
                order_items (
                    id,
                    product_id,
                    quantity,
                    price,
                    products (
                        id,
                        title
                    )
                )
            `)
            .eq("buyer_id", userId)
            .eq("payment_status", "paid")
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error(
                "Get support orders error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load orders"
            });
        }

        res.json({
            success: true,
            orders: data || []
        });

    } catch (error) {
        console.error(
            "Support orders error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    createSupportRequest,
    getMySupportRequests,
    getSupportOrders
};