const supabase = require("../config/supabase");
const path = require("path");

// CREATE PRODUCT
const createProduct = async (req, res) => {
    try {
        const {
            college_id,
            title,
            description,
            category,
            price,
            condition,
            stock
        } = req.body;

        if (
            !college_id ||
            !title ||
            !description ||
            !category ||
            price === undefined ||
            !condition ||
            stock === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "All product fields are required"
            });
        }

        if (Number(price) < 0) {
            return res.status(400).json({
                success: false,
                message: "Price cannot be negative"
            });
        }

        if (Number(stock) < 0 || !Number.isInteger(Number(stock))) {
            return res.status(400).json({
                success: false,
                message: "Stock must be a non-negative integer"
            });
        }

        const { data: product, error } = await supabase
            .from("products")
            .insert([
                {
                    seller_id: req.user.userId,
                    college_id: Number(college_id),
                    title,
                    description,
                    category,
                    price: Number(price),
                    condition,
                    stock: Number(stock),
                    status: Number(stock) > 0 ? "active" : "out_of_stock"
                }
            ])
            .select("*")
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            product
        });

    } catch (error) {
        console.error("Create product error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// GET ALL PRODUCTS WITH SEARCH AND FILTERS

const getProducts = async (req, res) => {
    try {
        const {
            search,
            category,
            college_id,
            condition,
            min_price,
            max_price,
            sort
        } = req.query;

        let query = supabase
            .from("products")
            .select(`
                *,
                colleges (
                    id,
                    name,
                    city
                ),
                product_images (
                    id,
                    image_url,
                    is_primary,
                    created_at
                )
            `)
            .eq("status", "active");

        // Search title and description
        if (search) {
            query = query.or(
                `title.ilike.%${search}%,description.ilike.%${search}%`
            );
        }

        // Category filter
        if (category) {
            query = query.eq("category", category);
        }

        // College filter
        if (college_id) {
            query = query.eq("college_id", Number(college_id));
        }

        // Condition filter
        if (condition) {
            query = query.eq("condition", condition);
        }

        // Minimum price
        if (min_price !== undefined) {
            query = query.gte("price", Number(min_price));
        }

        // Maximum price
        if (max_price !== undefined) {
            query = query.lte("price", Number(max_price));
        }

        // Sorting
        if (sort === "price_low") {
            query = query.order("price", { ascending: true });
        } else if (sort === "price_high") {
            query = query.order("price", { ascending: false });
        } else {
            // Default: newest products first
            query = query.order("created_at", { ascending: false });
        }

        const { data: products, error } = await query;

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            count: products.length,
            filters: {
                search: search || null,
                category: category || null,
                college_id: college_id || null,
                condition: condition || null,
                min_price: min_price || null,
                max_price: max_price || null,
                sort: sort || "newest"
            },
            products
        });

    } catch (error) {
        console.error("Get products error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// GET SINGLE PRODUCT
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: product, error: productError } = await supabase
            .from("products")
            .select(`
                *,
                colleges (
                    id,
                    name,
                    city
                )
            `)
            .eq("id", id)
            .single();

        if (productError || !product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Get product images
        const { data: images, error: imageError } = await supabase
            .from("product_images")
            .select("id, image_url, is_primary, created_at")
            .eq("product_id", id)
            .order("is_primary", { ascending: false })
            .order("created_at", { ascending: true });

        if (imageError) {
            return res.status(500).json({
                success: false,
                message: imageError.message
            });
        }

        res.json({
            success: true,
            product: {
                ...product,
                images: images || []
            }
        });

    } catch (error) {
        console.error("Get product error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// UPDATE PRODUCT
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            college_id,
            title,
            description,
            category,
            price,
            condition,
            stock
        } = req.body;

        // First check ownership
        const { data: existingProduct, error: findError } = await supabase
            .from("products")
            .select("*")
            .eq("id", id)
            .single();

        if (findError || !existingProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (existingProduct.seller_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: "You can only edit your own products"
            });
        }

        // Build update object
        const updates = {};

        if (college_id !== undefined) {
            updates.college_id = Number(college_id);
        }

        if (title !== undefined) {
            updates.title = title;
        }

        if (description !== undefined) {
            updates.description = description;
        }

        if (category !== undefined) {
            updates.category = category;
        }

        if (price !== undefined) {
            if (Number(price) < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Price cannot be negative"
                });
            }

            updates.price = Number(price);
        }

        if (condition !== undefined) {
            updates.condition = condition;
        }

        if (stock !== undefined) {
            if (
                Number(stock) < 0 ||
                !Number.isInteger(Number(stock))
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Stock must be a non-negative integer"
                });
            }

            updates.stock = Number(stock);
            updates.status =
                Number(stock) > 0 ? "active" : "out_of_stock";
        }

        const { data: product, error } = await supabase
            .from("products")
            .update(updates)
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: "Product updated successfully",
            product
        });

    } catch (error) {
        console.error("Update product error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// DELETE PRODUCT
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        // Check product
        const { data: existingProduct, error: findError } = await supabase
            .from("products")
            .select("id, seller_id")
            .eq("id", id)
            .single();

        if (findError || !existingProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check ownership
        if (existingProduct.seller_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own products"
            });
        }

        const { error } = await supabase
            .from("products")
            .delete()
            .eq("id", id);

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: "Product deleted successfully"
        });

    } catch (error) {
        console.error("Delete product error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// UPLOAD PRODUCT IMAGE
const uploadProductImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Image file is required"
            });
        }

        const { product_id, is_primary } = req.body;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        // Check product ownership
        const { data: product, error: productError } = await supabase
            .from("products")
            .select("id, seller_id")
            .eq("id", product_id)
            .single();

        if (productError || !product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (product.seller_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: "You can only upload images for your own products"
            });
        }

        const fileExt = path.extname(req.file.originalname);

        const fileName = `${req.user.userId}/${product_id}-${Date.now()}${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) {
            return res.status(500).json({
                success: false,
                message: uploadError.message
            });
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(fileName);

        const imageUrl = publicUrlData.publicUrl;

        // Save image record in database
        const { data: image, error: imageError } = await supabase
            .from("product_images")
            .insert([
                {
                    product_id: Number(product_id),
                    image_url: imageUrl,
                    is_primary: is_primary === "true"
                }
            ])
            .select()
            .single();

        if (imageError) {
            return res.status(500).json({
                success: false,
                message: imageError.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Product image uploaded successfully",
            image
        });

    } catch (error) {
        console.error("Upload image error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    uploadProductImage
};