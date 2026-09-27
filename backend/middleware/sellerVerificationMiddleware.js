const supabase = require("../config/supabase");

const sellerVerificationMiddleware = async (req, res, next) => {
    try {
        if (
            req.user.role !== "student_seller" &&
            req.user.role !== "business_seller"
        ) {
            return res.status(403).json({
                success: false,
                message: "Only sellers can list products."
            });
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("seller_verification_status")
            .eq("id", req.user.userId)
            .single();

        if (error || !user) {
            return res.status(500).json({
                success: false,
                message: "Unable to verify seller status."
            });
        }

        if (user.seller_verification_status !== "approved") {
            return res.status(403).json({
                success: false,
                message:
                    "Your seller account has not been verified yet."
            });
        }

        next();

    } catch (error) {
        console.error("Seller verification error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = sellerVerificationMiddleware;