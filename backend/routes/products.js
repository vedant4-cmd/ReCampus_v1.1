const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const sellerMiddleware = require("../middleware/sellerMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Helper functions
|--------------------------------------------------------------------------
*/

function createSlug(name) {
    return String(name)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 220);
}

async function getUniqueSlug(name, productId = null) {

    const baseSlug = createSlug(name) || "product";

    let slug = baseSlug;
    let counter = 1;

    while (true) {

        let query = `
            SELECT id
            FROM products
            WHERE slug = $1
        `;

        const params = [slug];

        if (productId) {
            query += ` AND id <> $2`;
            params.push(productId);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return slug;
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
    }
}


/*
|--------------------------------------------------------------------------
| Marketplace - Get products
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {

    try {

        const {
            search = "",
            maxPrice,
            condition,
            category_id,
            college_id,
            seller_id,
            sort = "newest",
            page = 1,
            limit = 20
        } = req.query;


        const pageNumber =
            Math.max(parseInt(page) || 1, 1);

        const limitNumber =
            Math.min(
                Math.max(parseInt(limit) || 20, 1),
                100
            );

        const offset =
            (pageNumber - 1) * limitNumber;


        const conditions = [
            `p.status = 'active'`,
            `COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0`
        ];

        const params = [];

        let paramIndex = 1;


        if (search.trim()) {

            conditions.push(`
                (
                    p.name ILIKE $${paramIndex}
                    OR p.description ILIKE $${paramIndex}
                    OR p.brand ILIKE $${paramIndex}
                    OR p.model ILIKE $${paramIndex}
                    OR c.name ILIKE $${paramIndex}
                    OR col.name ILIKE $${paramIndex}
                )
            `);

            params.push(`%${search.trim()}%`);
            paramIndex++;
        }


        if (maxPrice !== undefined && maxPrice !== "") {

            const price =
                Number(maxPrice);

            if (!Number.isNaN(price)) {

                conditions.push(
                    `p.price <= $${paramIndex}`
                );

                params.push(price);
                paramIndex++;
            }
        }


        if (condition) {

            conditions.push(
                `p.condition = $${paramIndex}`
            );

            params.push(condition);
            paramIndex++;
        }


        if (category_id) {

            conditions.push(
                `p.category_id = $${paramIndex}`
            );

            params.push(Number(category_id));
            paramIndex++;
        }


        if (college_id) {

            conditions.push(
                `p.college_id = $${paramIndex}`
            );

            params.push(Number(college_id));
            paramIndex++;
        }


        if (seller_id) {

            conditions.push(
                `sp.id = $${paramIndex}`
            );

            params.push(Number(seller_id));
            paramIndex++;
        }


        let orderBy =
            `p.created_at DESC`;

        switch (sort) {

            case "price_asc":
                orderBy = `p.price ASC`;
                break;

            case "price_desc":
                orderBy = `p.price DESC`;
                break;

            case "name_asc":
                orderBy = `p.name ASC`;
                break;

            case "oldest":
                orderBy = `p.created_at ASC`;
                break;

            case "newest":
            default:
                orderBy = `p.created_at DESC`;
        }


        const whereClause =
            conditions.join(" AND ");


        const countResult =
            await pool.query(
                `
                SELECT COUNT(*)::int AS total

                FROM products p

                LEFT JOIN categories c
                    ON c.id = p.category_id

                LEFT JOIN colleges col
                    ON col.id = p.college_id

                JOIN seller_profiles sp
                    ON sp.id = p.seller_id

                LEFT JOIN inventory i
                    ON i.product_id = p.id

                WHERE ${whereClause}
                `,
                params
            );


        const total =
            countResult.rows[0].total;


        const productResult =
            await pool.query(
                `
                SELECT
                    p.id,
                    p.name,
                    p.slug,
                    p.description,
                    p.brand,
                    p.model,
                    p.condition,
                    p.price,
                    p.original_price,
                    p.status,
                    p.is_featured,
                    p.created_at,
                    p.updated_at,

                    c.id AS category_id,
                    c.name AS category_name,

                    col.id AS college_id,
                    col.name AS college_name,

                    sp.id AS seller_id,
                    sp.display_name AS seller_name,
                    sp.seller_type,
                    sp.seller_status,

                    COALESCE(i.quantity, 0) AS quantity,
                    COALESCE(i.reserved_quantity, 0)
                        AS reserved_quantity,

                    GREATEST(
                        COALESCE(i.quantity, 0)
                        -
                        COALESCE(i.reserved_quantity, 0),
                        0
                    ) AS available_quantity,

                    (
                        SELECT pi.image_url
                        FROM product_images pi
                        WHERE pi.product_id = p.id
                        ORDER BY
                            pi.is_primary DESC,
                            pi.display_order ASC,
                            pi.id ASC
                        LIMIT 1
                    ) AS image_url

                FROM products p

                LEFT JOIN categories c
                    ON c.id = p.category_id

                LEFT JOIN colleges col
                    ON col.id = p.college_id

                JOIN seller_profiles sp
                    ON sp.id = p.seller_id

                LEFT JOIN inventory i
                    ON i.product_id = p.id

                WHERE ${whereClause}

                ORDER BY ${orderBy}

                LIMIT $${paramIndex}
                OFFSET $${paramIndex + 1}
                `,
                [
                    ...params,
                    limitNumber,
                    offset
                ]
            );


        res.json({
            success: true,
            products: productResult.rows,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total,
                totalPages:
                    Math.ceil(total / limitNumber)
            }
        });

    } catch (error) {

        console.error(
            "Marketplace products error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load products."
        });
    }
});


/*
|--------------------------------------------------------------------------
| Categories
|--------------------------------------------------------------------------
*/

router.get("/meta/categories", async (req, res) => {

    try {

        const result =
            await pool.query(`
                SELECT
                    id,
                    name,
                    description
                FROM categories
                ORDER BY name ASC
            `);


        res.json({
            success: true,
            categories: result.rows
        });

    } catch (error) {

        console.error(
            "Categories error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load categories."
        });
    }
});


/*
|--------------------------------------------------------------------------
| Colleges
|--------------------------------------------------------------------------
*/

router.get("/meta/colleges", async (req, res) => {

    try {

        const result =
            await pool.query(`
                SELECT
                    id,
                    name,
                    location,
                    city,
                    state
                FROM colleges
                ORDER BY name ASC
            `);


        res.json({
            success: true,
            colleges: result.rows
        });

    } catch (error) {

        console.error(
            "Colleges error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load colleges."
        });
    }
});


/*
|--------------------------------------------------------------------------
| Seller's own products
|--------------------------------------------------------------------------
*/

router.get(
    "/mine",
    authMiddleware,
    sellerMiddleware,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        p.id,
                        p.name,
                        p.slug,
                        p.description,
                        p.brand,
                        p.model,
                        p.condition,
                        p.price,
                        p.original_price,
                        p.status,
                        p.is_featured,
                        p.created_at,
                        p.updated_at,

                        c.id AS category_id,
                        c.name AS category_name,

                        col.id AS college_id,
                        col.name AS college_name,

                        COALESCE(i.quantity, 0)
                            AS quantity,

                        COALESCE(i.reserved_quantity, 0)
                            AS reserved_quantity,

                        GREATEST(
                            COALESCE(i.quantity, 0)
                            -
                            COALESCE(i.reserved_quantity, 0),
                            0
                        ) AS available_quantity,

                        (
                            SELECT pi.image_url
                            FROM product_images pi
                            WHERE pi.product_id = p.id
                            ORDER BY
                                pi.is_primary DESC,
                                pi.display_order ASC,
                                pi.id ASC
                            LIMIT 1
                        ) AS image_url

                    FROM products p

                    LEFT JOIN categories c
                        ON c.id = p.category_id

                    LEFT JOIN colleges col
                        ON col.id = p.college_id

                    LEFT JOIN inventory i
                        ON i.product_id = p.id

                    WHERE p.seller_id = $1
                      AND p.status <> 'deleted'

                    ORDER BY p.created_at DESC
                    `,
                    [req.seller.id]
                );


            res.json({
                success: true,
                products: result.rows
            });

        } catch (error) {

            console.error(
                "My products error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to load your products."
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| Product details
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {

    try {

        const productId =
            Number(req.params.id);

        if (!Number.isInteger(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    p.*,

                    c.name AS category_name,

                    col.name AS college_name,
                    col.city AS college_city,
                    col.state AS college_state,

                    sp.id AS seller_id,
                    sp.display_name AS seller_name,
                    sp.seller_type,
                    sp.seller_status,

                    u.name AS seller_user_name,

                    COALESCE(i.quantity, 0)
                        AS quantity,

                    COALESCE(i.reserved_quantity, 0)
                        AS reserved_quantity,

                    GREATEST(
                        COALESCE(i.quantity, 0)
                        -
                        COALESCE(i.reserved_quantity, 0),
                        0
                    ) AS available_quantity

                FROM products p

                LEFT JOIN categories c
                    ON c.id = p.category_id

                LEFT JOIN colleges col
                    ON col.id = p.college_id

                JOIN seller_profiles sp
                    ON sp.id = p.seller_id

                JOIN users u
                    ON u.id = sp.user_id

                LEFT JOIN inventory i
                    ON i.product_id = p.id

                WHERE p.id = $1
                  AND p.status <> 'deleted'
                `,
                [productId]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }


        const product =
            result.rows[0];


        const images =
            await pool.query(
                `
                SELECT
                    id,
                    image_url,
                    display_order,
                    is_primary

                FROM product_images

                WHERE product_id = $1

                ORDER BY
                    is_primary DESC,
                    display_order ASC,
                    id ASC
                `,
                [productId]
            );


        const attributes =
            await pool.query(
                `
                SELECT
                    id,
                    attribute_name,
                    attribute_value

                FROM product_attributes

                WHERE product_id = $1

                ORDER BY id ASC
                `,
                [productId]
            );


        res.json({
            success: true,
            product: {
                ...product,
                images: images.rows,
                attributes: attributes.rows
            }
        });

    } catch (error) {

        console.error(
            "Product detail error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load product."
        });
    }
});


/*
|--------------------------------------------------------------------------
| Create product
|--------------------------------------------------------------------------
*/

router.post(
    "/",
    authMiddleware,
    sellerMiddleware,
    async (req, res) => {

        const {
            name,
            description,
            brand,
            model,
            condition,
            price,
            original_price,
            category_id,
            college_id,
            quantity,
            low_stock_threshold = 5,
            images = [],
            attributes = []
        } = req.body;


        if (!name || !String(name).trim()) {

            return res.status(400).json({
                success: false,
                message: "Product name is required."
            });
        }


        const productPrice =
            Number(price);

        const productQuantity =
            Number(quantity);


        if (
            Number.isNaN(productPrice) ||
            productPrice < 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid product price."
            });
        }


        if (
            !Number.isInteger(productQuantity) ||
            productQuantity < 1
        ) {

            return res.status(400).json({
                success: false,
                message: "Quantity must be at least 1."
            });
        }


        const client =
            await pool.connect();


        try {

            await client.query("BEGIN");


            const slug =
                await getUniqueSlug(
                    name
                );


            const productResult =
                await client.query(
                    `
                    INSERT INTO products (
                        seller_id,
                        college_id,
                        category_id,
                        name,
                        slug,
                        description,
                        brand,
                        model,
                        condition,
                        price,
                        original_price,
                        status
                    )
                    VALUES (
                        $1,$2,$3,$4,$5,
                        $6,$7,$8,$9,$10,
                        $11,'active'
                    )

                    RETURNING *
                    `,
                    [
                        req.seller.id,
                        college_id || null,
                        category_id || null,
                        String(name).trim(),
                        slug,
                        description || null,
                        brand || null,
                        model || null,
                        condition || null,
                        productPrice,
                        original_price || null
                    ]
                );


            const product =
                productResult.rows[0];


            await client.query(
                `
                INSERT INTO inventory (
                    product_id,
                    quantity,
                    reserved_quantity,
                    low_stock_threshold
                )
                VALUES ($1,$2,0,$3)
                `,
                [
                    product.id,
                    productQuantity,
                    Number(low_stock_threshold) || 5
                ]
            );


            await client.query(
                `
                INSERT INTO inventory_movements (
                    product_id,
                    seller_id,
                    movement_type,
                    quantity,
                    previous_quantity,
                    new_quantity,
                    note
                )
                VALUES (
                    $1,$2,'restock',$3,0,$3,$4
                )
                `,
                [
                    product.id,
                    req.seller.id,
                    productQuantity,
                    "Initial product stock"
                ]
            );


            if (Array.isArray(images)) {

                const validImages =
                    images
                        .filter(
                            image =>
                                typeof image === "string" &&
                                image.trim()
                        )
                        .slice(0, 10);


                for (
                    let i = 0;
                    i < validImages.length;
                    i++
                ) {

                    await client.query(
                        `
                        INSERT INTO product_images (
                            product_id,
                            image_url,
                            display_order,
                            is_primary
                        )
                        VALUES ($1,$2,$3,$4)
                        `,
                        [
                            product.id,
                            validImages[i].trim(),
                            i,
                            i === 0
                        ]
                    );
                }
            }


            if (Array.isArray(attributes)) {

                for (
                    const attribute of attributes
                ) {

                    if (
                        attribute &&
                        attribute.name &&
                        attribute.value
                    ) {

                        await client.query(
                            `
                            INSERT INTO product_attributes (
                                product_id,
                                attribute_name,
                                attribute_value
                            )
                            VALUES ($1,$2,$3)
                            `,
                            [
                                product.id,
                                String(
                                    attribute.name
                                ).trim(),
                                String(
                                    attribute.value
                                ).trim()
                            ]
                        );
                    }
                }
            }


            await client.query("COMMIT");


            res.status(201).json({
                success: true,
                message: "Product created successfully.",
                product
            });

        } catch (error) {

            await client.query("ROLLBACK");

            console.error(
                "Create product error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to create product."
            });

        } finally {

            client.release();
        }
    }
);


/*
|--------------------------------------------------------------------------
| Update product
|--------------------------------------------------------------------------
*/

router.patch(
    "/:id",
    authMiddleware,
    sellerMiddleware,
    async (req, res) => {

        const productId =
            Number(req.params.id);

        if (!Number.isInteger(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }


        const {
            name,
            description,
            brand,
            model,
            condition,
            price,
            original_price,
            category_id,
            college_id,
            quantity,
            low_stock_threshold,
            images
        } = req.body;


        const client =
            await pool.connect();


        try {

            await client.query("BEGIN");


            const existing =
                await client.query(
                    `
                    SELECT
                        p.*,
                        COALESCE(
                            i.quantity,
                            0
                        ) AS quantity,
                        COALESCE(
                            i.reserved_quantity,
                            0
                        ) AS reserved_quantity

                    FROM products p

                    LEFT JOIN inventory i
                        ON i.product_id = p.id

                    WHERE p.id = $1
                      AND p.seller_id = $2
                      AND p.status <> 'deleted'

                    FOR UPDATE
                    `,
                    [
                        productId,
                        req.seller.id
                    ]
                );


            if (existing.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }


            const oldProduct =
                existing.rows[0];


            const newName =
                name !== undefined
                    ? String(name).trim()
                    : oldProduct.name;


            const newPrice =
                price !== undefined
                    ? Number(price)
                    : Number(oldProduct.price);


            if (!newName) {

                await client.query("ROLLBACK");

                return res.status(400).json({
                    success: false,
                    message: "Product name cannot be empty."
                });
            }


            if (
                Number.isNaN(newPrice) ||
                newPrice < 0
            ) {

                await client.query("ROLLBACK");

                return res.status(400).json({
                    success: false,
                    message: "Invalid product price."
                });
            }


            let newQuantity =
                quantity !== undefined
                    ? Number(quantity)
                    : Number(oldProduct.quantity);


            if (
                !Number.isInteger(newQuantity) ||
                newQuantity < 0
            ) {

                await client.query("ROLLBACK");

                return res.status(400).json({
                    success: false,
                    message: "Invalid inventory quantity."
                });
            }


            if (
                newQuantity <
                Number(oldProduct.reserved_quantity)
            ) {

                await client.query("ROLLBACK");

                return res.status(400).json({
                    success: false,
                    message:
                        "Quantity cannot be lower than currently reserved stock."
                });
            }


            let newSlug =
                oldProduct.slug;


            if (
                newName.toLowerCase() !==
                oldProduct.name.toLowerCase()
            ) {

                newSlug =
                    await getUniqueSlug(
                        newName,
                        productId
                    );
            }


            const newStatus =
                newQuantity === 0
                    ? "out_of_stock"
                    : (
                        oldProduct.status ===
                        "out_of_stock"
                            ? "active"
                            : oldProduct.status
                    );


            await client.query(
                `
                UPDATE products

                SET
                    name = $1,
                    slug = $2,
                    description = $3,
                    brand = $4,
                    model = $5,
                    condition = $6,
                    price = $7,
                    original_price = $8,
                    category_id = $9,
                    college_id = $10,
                    status = $11,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $12
                  AND seller_id = $13
                `,
                [
                    newName,
                    newSlug,
                    description !== undefined
                        ? description
                        : oldProduct.description,
                    brand !== undefined
                        ? brand
                        : oldProduct.brand,
                    model !== undefined
                        ? model
                        : oldProduct.model,
                    condition !== undefined
                        ? condition
                        : oldProduct.condition,
                    newPrice,
                    original_price !== undefined
                        ? original_price
                        : oldProduct.original_price,
                    category_id !== undefined
                        ? category_id || null
                        : oldProduct.category_id,
                    college_id !== undefined
                        ? college_id || null
                        : oldProduct.college_id,
                    newStatus,
                    productId,
                    req.seller.id
                ]
            );


            const oldQuantity =
                Number(oldProduct.quantity);


            await client.query(
                `
                UPDATE inventory

                SET
                    quantity = $1,
                    low_stock_threshold = $2,
                    updated_at = CURRENT_TIMESTAMP

                WHERE product_id = $3
                `,
                [
                    newQuantity,
                    low_stock_threshold !== undefined
                        ? Number(low_stock_threshold)
                        : 5,
                    productId
                ]
            );


            if (
                newQuantity !==
                oldQuantity
            ) {

                const movementType =
                    newQuantity > oldQuantity
                        ? "restock"
                        : "adjustment";


                await client.query(
                    `
                    INSERT INTO inventory_movements (
                        product_id,
                        seller_id,
                        movement_type,
                        quantity,
                        previous_quantity,
                        new_quantity,
                        note
                    )
                    VALUES (
                        $1,$2,$3,$4,$5,$6,$7
                    )
                    `,
                    [
                        productId,
                        req.seller.id,
                        movementType,
                        Math.abs(
                            newQuantity -
                            oldQuantity
                        ),
                        oldQuantity,
                        newQuantity,
                        "Seller inventory update"
                    ]
                );
            }


            /*
             * Replace image list only when images
             * are explicitly supplied.
             */

            if (Array.isArray(images)) {

                await client.query(
                    `
                    DELETE FROM product_images
                    WHERE product_id = $1
                    `,
                    [productId]
                );


                const validImages =
                    images
                        .filter(
                            image =>
                                typeof image === "string" &&
                                image.trim()
                        )
                        .slice(0, 10);


                for (
                    let i = 0;
                    i < validImages.length;
                    i++
                ) {

                    await client.query(
                        `
                        INSERT INTO product_images (
                            product_id,
                            image_url,
                            display_order,
                            is_primary
                        )
                        VALUES ($1,$2,$3,$4)
                        `,
                        [
                            productId,
                            validImages[i].trim(),
                            i,
                            i === 0
                        ]
                    );
                }
            }


            await client.query("COMMIT");


            res.json({
                success: true,
                message: "Product updated successfully."
            });

        } catch (error) {

            await client.query("ROLLBACK");

            console.error(
                "Update product error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to update product."
            });

        } finally {

            client.release();
        }
    }
);


/*
|--------------------------------------------------------------------------
| Deactivate product
|--------------------------------------------------------------------------
*/

router.patch(
    "/:id/deactivate",
    authMiddleware,
    sellerMiddleware,
    async (req, res) => {

        const productId =
            Number(req.params.id);


        if (!Number.isInteger(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }


        try {

            const result =
                await pool.query(
                    `
                    UPDATE products

                    SET
                        status = 'inactive',
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1
                      AND seller_id = $2
                      AND status <> 'deleted'

                    RETURNING id
                    `,
                    [
                        productId,
                        req.seller.id
                    ]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }


            res.json({
                success: true,
                message: "Product deactivated successfully."
            });

        } catch (error) {

            console.error(
                "Deactivate product error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to deactivate product."
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| Reactivate product
|--------------------------------------------------------------------------
*/

router.patch(
    "/:id/reactivate",
    authMiddleware,
    sellerMiddleware,
    async (req, res) => {

        const productId =
            Number(req.params.id);


        if (!Number.isInteger(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }


        try {

            const result =
                await pool.query(
                    `
                    UPDATE products p

                    SET
                        status =
                            CASE
                                WHEN COALESCE(
                                    (
                                        SELECT quantity
                                        FROM inventory
                                        WHERE product_id = p.id
                                    ),
                                    0
                                ) > 0
                                THEN 'active'
                                ELSE 'out_of_stock'
                            END,

                        updated_at = CURRENT_TIMESTAMP

                    WHERE p.id = $1
                      AND p.seller_id = $2
                      AND p.status <> 'deleted'

                    RETURNING id, status
                    `,
                    [
                        productId,
                        req.seller.id
                    ]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }


            res.json({
                success: true,
                message: "Product reactivated successfully.",
                status: result.rows[0].status
            });

        } catch (error) {

            console.error(
                "Reactivate product error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to reactivate product."
            });
        }
    }
);


/*
|--------------------------------------------------------------------------
| Delete product
|--------------------------------------------------------------------------
*/

router.delete(
    "/:id",
    authMiddleware,
    sellerMiddleware,
    async (req, res) => {

        const productId =
            Number(req.params.id);


        if (!Number.isInteger(productId)) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }


        try {

            const result =
                await pool.query(
                    `
                    UPDATE products

                    SET
                        status = 'deleted',
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1
                      AND seller_id = $2
                      AND status <> 'deleted'

                    RETURNING id
                    `,
                    [
                        productId,
                        req.seller.id
                    ]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }


            res.json({
                success: true,
                message: "Product deleted successfully."
            });

        } catch (error) {

            console.error(
                "Delete product error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to delete product."
            });
        }
    }
);


module.exports = router;