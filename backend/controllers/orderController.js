const supabase = require("../config/supabase");
const { verifyPayment } = require("./paymentController");
const {createNotification} = require("../utils/notification");


const createOrder = async (req, res) => {

    try {

        const buyerId = req.user.userId;

        const { items } = req.body;


        if (!items || !Array.isArray(items) || items.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Order items are required"
            });

        }


        let totalAmount = 0;

        const orderItems = [];


        // Check every product
        for (const item of items) {

            if (!item.product_id || !item.quantity) {

                return res.status(400).json({
                    success: false,
                    message: "Product ID and quantity are required"
                });

            }


            const quantity = Number(item.quantity);


            if (!Number.isInteger(quantity) || quantity <= 0) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid quantity"
                });

            }


            const { data: product, error: productError } =
                await supabase
                    .from("products")
                    .select(`
                        id,
                        seller_id,
                        title,
                        price,
                        stock,
                        status
                    `)
                    .eq("id", item.product_id)
                    .single();


            if (productError || !product) {

                return res.status(404).json({
                    success: false,
                    message: `Product ${item.product_id} not found`
                });

            }


            if (product.status !== "active") {

                return res.status(400).json({
                    success: false,
                    message: `${product.title} is not available`
                });

            }


            if (product.stock < quantity) {

                return res.status(400).json({
                    success: false,
                    message: `Only ${product.stock} item(s) available for ${product.title}`
                });

            }


            const itemTotal =
                Number(product.price) * quantity;


            totalAmount += itemTotal;


            orderItems.push({

                product_id: product.id,

                seller_id: product.seller_id,

                quantity: quantity,

                price: product.price

            });

        }


        // Create order
        const { data: order, error: orderError } =
            await supabase
                .from("orders")
                .insert([
                    {
                        buyer_id: buyerId,
                        total_amount: totalAmount,
                        payment_status: "pending",
                        order_status: "placed"
                    }
                ])
                .select()
                .single();


        if (orderError) {

            return res.status(500).json({
                success: false,
                message: orderError.message
            });

        }


        // Add order items
        const itemsWithOrderId =
            orderItems.map(item => ({

                ...item,

                order_id: order.id

            }));


        const { data: createdItems, error: itemsError } =
            await supabase
                .from("order_items")
                .insert(itemsWithOrderId)
                .select();


        if (itemsError) {

            // Remove order if items failed
            await supabase
                .from("orders")
                .delete()
                .eq("id", order.id);


            return res.status(500).json({
                success: false,
                message: itemsError.message
            });

        }

        res.status(201).json({

            success: true,

            message: "Order created successfully",

            order: {
                ...order,
                total_amount: totalAmount
            },

            items: createdItems

        });


    } catch (error) {

        console.error("Create order error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }

};

const getMyOrders = async (req, res) => {
    try {
        const buyerId = req.user.userId;

        const { data: orders, error } = await supabase
            .from("orders")
            .select(`
                id,
                total_amount,
                payment_status,
                order_status,
                razorpay_order_id,
                razorpay_payment_id,
                created_at,
                updated_at,
                order_items (
                    id,
                    product_id,
                    seller_id,
                    quantity,
                    price,
                    products (
                        id,
                        title,
                        category
                    )
                )
            `)
            .eq("buyer_id", buyerId)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {
        console.error("Get my orders error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;

        console.log("=================================");
        console.log("ORDER DETAILS REQUEST");
        console.log("Order ID:", orderId);
        console.log("User:", req.user);
        console.log("=================================");

        const { data: order, error } = await supabase
            .from("orders")
            .select(`
                id,
                buyer_id,
                total_amount,
                payment_status,
                order_status,
                razorpay_order_id,
                razorpay_payment_id,
                created_at,
                updated_at,
                order_items (
                    id,
                    product_id,
                    seller_id,
                    quantity,
                    price,
                    created_at,
                    products (
                        id,
                        title,
                        description,
                        category,
                        price,
                        condition,
                        status,
                        product_images (
                            id,
                            image_url,
                            is_primary
                        )
                    )
                )
            `)
            .eq("id", orderId)
            .single();

        console.log("Supabase order:", order);
        console.log("Supabase error:", error);

        if (error || !order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
                error: error?.message || null
            });
        }

        // Make sure the logged-in buyer owns this order
        if (order.buyer_id !== req.user.userId) {

            console.log("OWNER CHECK FAILED");
            console.log("Order buyer:", order.buyer_id);
            console.log("Logged-in user:", req.user.userId);

            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this order"
            });
        }

        res.json({
            success: true,
            order
        });

    } catch (error) {

        console.error("Get order error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getOrderById,
    verifyPayment
};