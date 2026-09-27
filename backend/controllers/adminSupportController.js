const supabase = require("../config/supabase");
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


// GET ALL SUPPORT REQUESTS
const getAllSupportRequests = async (req, res) => {
    try {

        const { data, error } = await supabase
            .from("support_requests")
            .select(`
            id,
            user_id,
            order_id,
            product_id,
            type,
            reason,
            description,
            status,
            admin_response,
            refund_id,
            refunded_at,
            created_at,
            updated_at,
            users(name,email)
            `)
            .order("created_at", {
                ascending: false
            });


        if (error) {

            console.error(
                "Get admin support requests error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load support requests"
            });

        }


        res.json({
            success: true,
            requests: data || []
        });


    } catch (error) {

        console.error(
            "Admin support error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }
};


// UPDATE SUPPORT REQUEST
const updateSupportRequest = async (req, res) => {
    try {

        const requestId = req.params.id;

        const {
            status,
            admin_response
        } = req.body;

        const allowedStatuses = [
            "open",
            "in_review",
            "approved",
            "rejected",
            "resolved"
        ];

        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });

        }

        // Get the existing support request
        const {
            data: existingRequest,
            error: fetchError
        } = await supabase
            .from("support_requests")
            .select(`
                id,
                user_id,
                type
            `)
            .eq("id", requestId)
            .single();

        if (fetchError || !existingRequest) {

            return res.status(404).json({
                success: false,
                message: "Support request not found"
            });

        }

        // Update support request
        const {
            data,
            error
        } = await supabase
            .from("support_requests")
            .update({
                status,
                admin_response:
                    admin_response || null,
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", requestId)
            .select()
            .single();

        if (error) {

            console.error(
                "Update support request error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to update request"
            });

        }

        // Notify buyer
        const typeNames = {
            support: "support request",
            refund: "refund request",
            replacement: "replacement request"
        };

        const statusNames = {
            open: "Open",
            in_review: "In Review",
            approved: "Approved",
            rejected: "Rejected",
            resolved: "Resolved"
        };

        await supabase
            .from("notifications")
            .insert({
                user_id: existingRequest.user_id,
                title: "Support Request Updated",
                message:
                    `Your ${typeNames[existingRequest.type] || "support request"} ` +
                    `#${existingRequest.id} is now ${statusNames[status] || status}.`,
                type: "support_update",
                is_read: false
            });

        res.json({
            success: true,
            message: "Support request updated",
            request: data
        });

    } catch (error) {

        console.error(
            "Admin support update error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    }
};

// PROCESS RAZORPAY REFUND
const processRefund = async (req, res) => {
    try {

        const requestId = req.params.id;

        // Get refund request + related order
        const { data: supportRequest, error: requestError } =
            await supabase
                .from("support_requests")
                .select(`
                    id,
                    user_id,
                    order_id,
                    type,
                    status,
                    refund_id,
                    orders (
                        id,
                        buyer_id,
                        total_amount,
                        payment_status,
                        razorpay_payment_id
                    )
                `)
                .eq("id", requestId)
                .single();

        if (requestError || !supportRequest) {

            return res.status(404).json({
                success: false,
                message: "Support request not found"
            });

        }

        // Only refund requests can be refunded
        if (supportRequest.type !== "refund") {

            return res.status(400).json({
                success: false,
                message: "This is not a refund request"
            });

        }

        // Admin must approve first
        if (supportRequest.status !== "approved") {

            return res.status(400).json({
                success: false,
                message: "Refund must be approved first"
            });

        }

        // Prevent duplicate refunds
        if (supportRequest.refund_id) {

            return res.status(400).json({
                success: false,
                message: "Refund has already been processed"
            });

        }

        const order = supportRequest.orders;

        if (!order) {

            return res.status(400).json({
                success: false,
                message: "Order not found"
            });

        }

        // Verify payment
        if (order.payment_status !== "paid") {

            return res.status(400).json({
                success: false,
                message: "Order payment is not completed"
            });

        }

        if (!order.razorpay_payment_id) {

            return res.status(400).json({
                success: false,
                message: "Razorpay payment ID not found"
            });

        }

        // Razorpay expects amount in paise
        const refund = await razorpay.payments.refund(
            order.razorpay_payment_id,
            {
                amount: Math.round(
                    Number(order.total_amount) * 100
                ),
                speed: "normal",
                notes: {
                    support_request_id:
                        String(supportRequest.id),
                    order_id:
                        String(order.id)
                }
            }
        );

        // Save refund information
        const { data: updatedRequest, error: updateError } =
            await supabase
                .from("support_requests")
                .update({
                    refund_id: refund.id,
                    refunded_at: new Date().toISOString(),
                    status: "resolved",
                    updated_at: new Date().toISOString()
                })
                .eq("id", requestId)
                .select()
                .single();

        if (updateError) {

            console.error(
                "Save refund information error:",
                updateError
            );

            return res.status(500).json({
                success: false,
                message: "Refund processed but failed to save refund information"
            });

        }

        // Update order payment status
        await supabase
            .from("orders")
            .update({
                payment_status: "refunded",
                updated_at: new Date().toISOString()
            })
            .eq("id", order.id);

        // Notify buyer
        await supabase
            .from("notifications")
            .insert({
                user_id: supportRequest.user_id,
                title: "Refund Processed",
                message:
                    `Your refund for order #${order.id} has been processed successfully.`,
                type: "refund",
                is_read: false
            });

        res.json({
            success: true,
            message: "Refund processed successfully",
            refund_id: refund.id,
            request: updatedRequest
        });

    } catch (error) {

        console.error(
            "Refund processing error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error?.error?.description ||
                error?.message ||
                "Failed to process refund"
        });

    }
};

// PROCESS REPLACEMENT
const processReplacement = async (req, res) => {
    try {
        const requestId = req.params.id;

        const { data: supportRequest, error: requestError } =
            await supabase
                .from("support_requests")
                .select(`
                    id,
                    user_id,
                    order_id,
                    product_id,
                    type,
                    status,
                    admin_response
                `)
                .eq("id", requestId)
                .single();

        if (requestError || !supportRequest) {
            return res.status(404).json({
                success: false,
                message: "Support request not found"
            });
        }

        if (supportRequest.type !== "replacement") {
            return res.status(400).json({
                success: false,
                message: "This is not a replacement request"
            });
        }

        if (supportRequest.status !== "approved") {
            return res.status(400).json({
                success: false,
                message: "Replacement must be approved first"
            });
        }

        const updatedResponse = supportRequest.admin_response
            ? `${supportRequest.admin_response}\n\nReplacement processed successfully.`
            : "Replacement processed successfully.";

        const { data: updatedRequest, error: updateError } =
            await supabase
                .from("support_requests")
                .update({
                    status: "resolved",
                    admin_response: updatedResponse,
                    updated_at: new Date().toISOString()
                })
                .eq("id", requestId)
                .select()
                .single();

        if (updateError) {
            console.error(
                "Process replacement update error:",
                updateError
            );

            return res.status(500).json({
                success: false,
                message: "Failed to process replacement"
            });
        }

        await supabase
            .from("notifications")
            .insert({
                user_id: supportRequest.user_id,
                title: "Replacement Processed",
                message:
                    `Your replacement request #${supportRequest.id}` +
                    ` for order #${supportRequest.order_id} has been processed successfully.`,
                type: "support_update",
                is_read: false
            });

        res.json({
            success: true,
            message: "Replacement processed successfully",
            request: updatedRequest
        });

    } catch (error) {
        console.error(
            "Replacement processing error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error?.message ||
                "Failed to process replacement"
        });
    }
};

module.exports = {
    getAllSupportRequests,
    updateSupportRequest,
    processRefund,
    processReplacement
};