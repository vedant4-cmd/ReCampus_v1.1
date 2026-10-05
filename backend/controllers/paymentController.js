const crypto = require("crypto");
const supabase = require("../config/supabase");
const razorpay = require("../config/razorpay");
const { createNotification } = require("../utils/notification");

// =====================================================
// COMMISSION RULES
// =====================================================

const COMMISSION_RATES = {
    student_seller: 5,
    business_seller: 10
};


// =====================================================
// CREATE RAZORPAY ORDER
// =====================================================

const createPaymentOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const buyerId = req.user.userId;

        const { data: order, error } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .eq("buyer_id", buyerId)
            .single();

        if (error || !order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.payment_status === "paid") {
            return res.status(400).json({
                success: false,
                message: "Order is already paid"
            });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(Number(order.total_amount) * 100),
            currency: "INR",
            receipt: `order_${order.id}`
        });

        const { error: updateError } = await supabase
            .from("orders")
            .update({
                razorpay_order_id: razorpayOrder.id
            })
            .eq("id", order.id);

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: updateError.message
            });
        }

        res.json({
            success: true,
            key_id: process.env.RAZORPAY_KEY_ID,
            razorpay_order: razorpayOrder
        });

    } catch (error) {
        console.error("Create payment order error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create payment order"
        });
    }
};


// =====================================================
// VERIFY PAYMENT
// =====================================================

const verifyPayment = async (req, res) => {
    try {
        const {
            orderId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const buyerId = req.user.userId;

        if (
            !orderId ||
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment details are required"
            });
        }

        // -------------------------------------------------
        // Find order
        // -------------------------------------------------

        const { data: order, error } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .eq("buyer_id", buyerId)
            .single();

        if (error || !order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // -------------------------------------------------
        // Prevent duplicate payment verification
        // -------------------------------------------------

        if (order.payment_status === "paid") {
            return res.status(200).json({
                success: true,
                message: "Payment was already verified",
                order
            });
        }

        // -------------------------------------------------
        // Validate Razorpay order
        // -------------------------------------------------

        if (order.razorpay_order_id !== razorpay_order_id) {
            return res.status(400).json({
                success: false,
                message: "Invalid Razorpay order"
            });
        }

        // -------------------------------------------------
        // Verify Razorpay signature
        // -------------------------------------------------

        const generatedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                razorpay_order_id + "|" + razorpay_payment_id
            )
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature"
            });
        }

        // -------------------------------------------------
        // Get order items
        // -------------------------------------------------

        const {
            data: orderItems,
            error: itemsError
        } = await supabase
            .from("order_items")
            .select(
                "id, product_id, seller_id, quantity, price"
            )
            .eq("order_id", order.id);

        if (itemsError) {
            return res.status(500).json({
                success: false,
                message: itemsError.message
            });
        }

        if (!orderItems || orderItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Order contains no products"
            });
        }

        // -------------------------------------------------
        // Get seller roles
        // -------------------------------------------------

        const sellerIds = [
            ...new Set(
                orderItems.map(item => item.seller_id)
            )
        ];

        const {
            data: sellers,
            error: sellersError
        } = await supabase
            .from("users")
            .select("id, role")
            .in("id", sellerIds);

        if (sellersError) {
            return res.status(500).json({
                success: false,
                message: sellersError.message
            });
        }

        const sellerRoleMap = {};

        for (const seller of sellers || []) {
            sellerRoleMap[seller.id] = seller.role;
        }

        // -------------------------------------------------
        // Calculate commission for every order item
        // -------------------------------------------------

        const commissionItems = [];

        for (const item of orderItems) {

            const sellerRole =
                sellerRoleMap[item.seller_id];

            const commissionRate =
                COMMISSION_RATES[sellerRole] || 0;

            const saleAmount =
                Number(item.price) *
                Number(item.quantity);

            const commissionAmount =
                Number(
                    (
                        saleAmount *
                        commissionRate /
                        100
                    ).toFixed(2)
                );

            commissionItems.push({
                orderItemId: item.id,
                sellerId: item.seller_id,
                sellerRole,
                saleAmount,
                commissionRate,
                commissionAmount
            });
        }

        // -------------------------------------------------
        // Verify inventory before completing payment
        // -------------------------------------------------

        for (const item of orderItems) {

            const {
                data: product,
                error: productError
            } = await supabase
                .from("products")
                .select("id, stock")
                .eq("id", item.product_id)
                .single();

            if (productError || !product) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Product inventory could not be verified"
                });
            }

            if (
                product.stock <
                item.quantity
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Product is no longer available in the requested quantity"
                });
            }
        }

        // -------------------------------------------------
        // Reduce inventory
        // -------------------------------------------------

        for (const item of orderItems) {

            const {
                data: product,
                error: productError
            } = await supabase
                .from("products")
                .select("id, stock")
                .eq("id", item.product_id)
                .single();

            if (productError || !product) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Product inventory could not be verified"
                });
            }

            const newStock =
                product.stock -
                item.quantity;

            const {
                error: stockError
            } = await supabase
                .from("products")
                .update({
                    stock: newStock,
                    status:
                        newStock === 0
                            ? "sold"
                            : "active"
                })
                .eq("id", product.id);

            if (stockError) {
                return res.status(500).json({
                    success: false,
                    message: stockError.message
                });
            }
        }

        // -------------------------------------------------
        // STORE COMMISSION
        // -------------------------------------------------

        for (const commissionItem of commissionItems) {

            const {
                error: commissionError
            } = await supabase
                .from("order_items")
                .update({
                    commission_rate:
                        commissionItem.commissionRate,

                    commission_amount:
                        commissionItem.commissionAmount
                })
                .eq(
                    "id",
                    commissionItem.orderItemId
                );

            if (commissionError) {
                console.error(
                    "Commission update error:",
                    commissionError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to record seller commission"
                });
            }
        }

        // -------------------------------------------------
        // Mark order as paid
        // -------------------------------------------------

        const {
            data: updatedOrder,
            error: updateError
        } = await supabase
            .from("orders")
            .update({
                payment_status: "paid",
                order_status: "confirmed",
                razorpay_payment_id
            })
            .eq("id", order.id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: updateError.message
            });
        }

        // -------------------------------------------------
        // Buyer payment notification
        // -------------------------------------------------

        await createNotification({
            userId: buyerId,
            title: "Payment Successful",
            message:
                `Your payment for order #${order.id} was successful.`,
            type: "payment"
        });

        // -------------------------------------------------
        // Buyer order confirmation notification
        // -------------------------------------------------

        await createNotification({
            userId: buyerId,
            title: "Order Confirmed",
            message:
                `Your order #${order.id} has been confirmed.`,
            type: "order"
        });

        // -------------------------------------------------
        // Return successful response
        // -------------------------------------------------

        res.json({
            success: true,
            message: "Payment verified successfully",
            order: updatedOrder
        });

    } catch (error) {
        console.error(
            "Verify payment error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Payment verification failed"
        });
    }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    createPaymentOrder,
    verifyPayment
};