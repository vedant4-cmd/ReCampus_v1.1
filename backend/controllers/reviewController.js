const supabase = require("../config/supabase");

// CREATE REVIEW
const createReview = async (req, res) => {
    try {
        const buyerId = req.user.userId;
        const { product_id, rating, comment } = req.body;

        if (!product_id || !rating || !comment) {
            return res.status(400).json({
                success: false,
                message: "Product, rating and comment are required"
            });
        }

        const numericRating = Number(rating);

        if (
            !Number.isInteger(numericRating) ||
            numericRating < 1 ||
            numericRating > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        // Check that the buyer has purchased this product
        const { data: purchasedItem, error: purchaseError } =
            await supabase
                .from("order_items")
                .select(`
                    id,
                    orders!inner (
                        id,
                        buyer_id,
                        payment_status
                    )
                `)
                .eq("product_id", product_id)
                .eq("orders.buyer_id", buyerId)
                .eq("orders.payment_status", "paid")
                .limit(1)
                .maybeSingle();

        if (purchaseError) {
            return res.status(500).json({
                success: false,
                message: purchaseError.message
            });
        }

        if (!purchasedItem) {
            return res.status(403).json({
                success: false,
                message: "You can only review products you have purchased"
            });
        }

        // Prevent duplicate review
        const { data: existingReview, error: existingError } =
            await supabase
                .from("reviews")
                .select("id")
                .eq("product_id", product_id)
                .eq("buyer_id", buyerId)
                .maybeSingle();

        if (existingError) {
            return res.status(500).json({
                success: false,
                message: existingError.message
            });
        }

        if (existingReview) {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product"
            });
        }

        const { data: review, error } =
            await supabase
                .from("reviews")
                .insert([
                    {
                        product_id,
                        buyer_id: buyerId,
                        rating: numericRating,
                        comment: comment.trim()
                    }
                ])
                .select()
                .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Review submitted successfully",
            review
        });

    } catch (error) {
        console.error("Create review error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// GET PRODUCT REVIEWS
const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        const { data: reviews, error } =
            await supabase
                .from("reviews")
                .select(`
                    id,
                    product_id,
                    buyer_id,
                    rating,
                    comment,
                    created_at,
                    users (
                        name
                    )
                `)
                .eq("product_id", productId)
                .order("created_at", {
                    ascending: false
                });

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        const totalReviews = reviews.length;

        const averageRating =
            totalReviews > 0
                ? reviews.reduce(
                    (sum, review) =>
                        sum + Number(review.rating),
                    0
                ) / totalReviews
                : 0;

        res.json({
            success: true,
            total_reviews: totalReviews,
            average_rating:
                Number(averageRating.toFixed(1)),
            reviews
        });

    } catch (error) {
        console.error("Get reviews error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    createReview,
    getProductReviews
};