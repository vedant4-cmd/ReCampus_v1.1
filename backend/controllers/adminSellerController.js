const supabase = require("../config/supabase");

// GET PENDING SELLERS
const getPendingSellers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("users")
            .select(`
                id,
                name,
                email,
                role,
                college_id,
                seller_verification_status,
                created_at,
                colleges (
                    id,
                    name,
                    city
                )
            `)
            .in("role", [
                "student_seller",
                "business_seller"
            ])
            .eq("seller_verification_status", "pending")
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error(
                "Get pending sellers error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load pending sellers"
            });
        }

        res.json({
            success: true,
            sellers: data || []
        });

    } catch (error) {
        console.error(
            "Pending sellers error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// APPROVE SELLER
const approveSeller = async (req, res) => {
    try {
        const sellerId = req.params.id;

        const { data: seller, error: findError } =
            await supabase
                .from("users")
                .select(`
                    id,
                    name,
                    email,
                    role,
                    seller_verification_status
                `)
                .eq("id", sellerId)
                .single();

        if (findError || !seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found"
            });
        }

        if (
            seller.role !== "student_seller" &&
            seller.role !== "business_seller"
        ) {
            return res.status(400).json({
                success: false,
                message: "This user is not a seller"
            });
        }

        const { data, error } = await supabase
            .from("users")
            .update({
                seller_verification_status: "approved"
            })
            .eq("id", sellerId)
            .select(`
                id,
                name,
                email,
                role,
                seller_verification_status
            `)
            .single();

        if (error) {
            console.error(
                "Approve seller error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to approve seller"
            });
        }

        // Notify seller
        await supabase
            .from("notifications")
            .insert({
                user_id: sellerId,
                title: "Seller Verification Approved",
                message:
                    "Your seller account has been approved. You can now list products on ReCampus.",
                type: "seller_verification",
                is_read: false
            });

        res.json({
            success: true,
            message: "Seller approved successfully",
            seller: data
        });

    } catch (error) {
        console.error(
            "Approve seller error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// REJECT SELLER
const rejectSeller = async (req, res) => {
    try {
        const sellerId = req.params.id;

        const { data: seller, error: findError } =
            await supabase
                .from("users")
                .select(`
                    id,
                    name,
                    email,
                    role,
                    seller_verification_status
                `)
                .eq("id", sellerId)
                .single();

        if (findError || !seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found"
            });
        }

        if (
            seller.role !== "student_seller" &&
            seller.role !== "business_seller"
        ) {
            return res.status(400).json({
                success: false,
                message: "This user is not a seller"
            });
        }

        const { data, error } = await supabase
            .from("users")
            .update({
                seller_verification_status: "rejected"
            })
            .eq("id", sellerId)
            .select(`
                id,
                name,
                email,
                role,
                seller_verification_status
            `)
            .single();

        if (error) {
            console.error(
                "Reject seller error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to reject seller"
            });
        }

        // Notify seller
        await supabase
            .from("notifications")
            .insert({
                user_id: sellerId,
                title: "Seller Verification Rejected",
                message:
                    "Your seller verification was rejected. Please contact the administrator for more information.",
                type: "seller_verification",
                is_read: false
            });

        res.json({
            success: true,
            message: "Seller rejected successfully",
            seller: data
        });

    } catch (error) {
        console.error(
            "Reject seller error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    getPendingSellers,
    approveSeller,
    rejectSeller
};