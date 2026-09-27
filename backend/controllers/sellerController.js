const supabase = require("../config/supabase");

// GET SELLER PROFILE
const getSellerProfile = async (req, res) => {
    try {
        const { sellerId } = req.params;

        // Get seller information
        const { data: seller, error: sellerError } =
            await supabase
                .from("users")
                .select(`
                    id,
                    name,
                    role,
                    college_id,
                    is_verified,
                    created_at,
                    colleges (
                        id,
                        name,
                        city
                    )
                `)
                .eq("id", sellerId)
                .single();

        if (sellerError || !seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found"
            });
        }

        // Get seller's products
        const { data: products, error: productsError } =
            await supabase
                .from("products")
                .select(`
                    id,
                    title,
                    description,
                    category,
                    price,
                    condition,
                    stock,
                    status,
                    created_at,
                    product_images (
                        id,
                        image_url,
                        is_primary
                    )
                `)
                .eq("seller_id", sellerId)
                .order("created_at", {
                    ascending: false
                });

        if (productsError) {
            return res.status(500).json({
                success: false,
                message: productsError.message
            });
        }

        // Calculate total products sold
        const { data: soldItems, error: soldError } =
            await supabase
                .from("order_items")
                .select(`
                    quantity,
                    orders!inner (
                        payment_status
                    )
                `)
                .eq("seller_id", sellerId)
                .eq("orders.payment_status", "paid");

        if (soldError) {
            return res.status(500).json({
                success: false,
                message: soldError.message
            });
        }

        const productsSold =
            (soldItems || []).reduce(
                (total, item) =>
                    total + Number(item.quantity || 0),
                0
            );

        const activeProducts =
            (products || []).filter(
                product => product.status === "active"
            );

        res.json({
            success: true,
            seller: {
                id: seller.id,
                name: seller.name,
                role: seller.role,
                phone: seller.phone,
                is_verified: seller.is_verified,
                created_at: seller.created_at,
                college: seller.colleges || null,

                statistics: {
                    products_listed: products.length,
                    active_products: activeProducts.length,
                    products_sold: productsSold
                },

                products
            }
        });

    } catch (error) {
        console.error(
            "Get seller profile error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    getSellerProfile
};