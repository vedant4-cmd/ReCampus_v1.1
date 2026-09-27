const supabase = require("../config/supabase");

// ADD TO WISHLIST
const addToWishlist = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { product_id } = req.body;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        // Check product exists
        const { data: product, error: productError } =
            await supabase
                .from("products")
                .select("id")
                .eq("id", product_id)
                .single();

        if (productError || !product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Prevent duplicate wishlist entries
        const { data: existing, error: existingError } =
            await supabase
                .from("wishlists")
                .select("id")
                .eq("user_id", userId)
                .eq("product_id", product_id)
                .maybeSingle();

        if (existingError) {
            return res.status(500).json({
                success: false,
                message: existingError.message
            });
        }

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Product already in wishlist"
            });
        }

        const { data: wishlist, error } =
            await supabase
                .from("wishlists")
                .insert([
                    {
                        user_id: userId,
                        product_id: product_id
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
            message: "Added to wishlist",
            wishlist
        });

    } catch (error) {
        console.error("Add wishlist error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// REMOVE FROM WISHLIST
const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { productId } = req.params;

        const { data, error } =
            await supabase
                .from("wishlists")
                .delete()
                .eq("user_id", userId)
                .eq("product_id", productId)
                .select();

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product is not in your wishlist"
            });
        }

        res.json({
            success: true,
            message: "Removed from wishlist"
        });

    } catch (error) {
        console.error("Remove wishlist error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// GET MY WISHLIST
const getMyWishlist = async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data: wishlist, error } =
            await supabase
                .from("wishlists")
                .select(`
                    id,
                    product_id,
                    created_at,
                    products (
                        id,
                        title,
                        description,
                        category,
                        price,
                        condition,
                        stock,
                        status,
                        college_id,
                        product_images (
                            id,
                            image_url,
                            is_primary
                        ),
                        colleges (
                            id,
                            name,
                            city
                        )
                    )
                `)
                .eq("user_id", userId)
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
            count: wishlist.length,
            wishlist
        });

    } catch (error) {
        console.error("Get wishlist error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    addToWishlist,
    removeFromWishlist,
    getMyWishlist
};