const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

// Get or create wishlist for logged-in user
async function getOrCreateWishlist(userId) {
  const existing = await pool.query(
    `
    SELECT id
    FROM wishlists
    WHERE user_id = $1
    `,
    [userId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const created = await pool.query(
    `
    INSERT INTO wishlists (user_id)
    VALUES ($1)
    RETURNING id
    `,
    [userId]
  );

  return created.rows[0].id;
}

// GET /api/wishlist
router.get("/", authMiddleware, async (req, res) => {
  try {
    const wishlistId = await getOrCreateWishlist(req.user.id);

    const result = await pool.query(
      `
      SELECT
        wi.id AS wishlist_item_id,
        p.id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.original_price,
        p.condition,
        p.status,
        p.created_at,

        c.name AS category_name,
        col.name AS college_name,

        u.id AS seller_id,
        u.name AS seller_name,

        i.quantity,
        i.reserved_quantity,

        (
          i.quantity - i.reserved_quantity
        ) AS available_quantity,

        (
          SELECT pi.image_url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY pi.is_primary DESC, pi.display_order ASC
          LIMIT 1
        ) AS image_url

      FROM wishlist_items wi

      INNER JOIN products p
        ON p.id = wi.product_id

      LEFT JOIN categories c
        ON c.id = p.category_id

      LEFT JOIN colleges col
        ON col.id = p.college_id

      INNER JOIN users u
        ON u.id = p.seller_id

      LEFT JOIN inventory i
        ON i.product_id = p.id

      WHERE wi.wishlist_id = $1

      ORDER BY wi.created_at DESC
      `,
      [wishlistId]
    );

    res.json({
      success: true,
      wishlist_id: wishlistId,
      count: result.rows.length,
      items: result.rows
    });

  } catch (error) {
    console.error("Wishlist GET error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load wishlist."
    });
  }
});

// POST /api/wishlist/:productId
router.post("/:productId", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const { productId } = req.params;

    await client.query("BEGIN");

    const product = await client.query(
      `
      SELECT id, name, status
      FROM products
      WHERE id = $1
      `,
      [productId]
    );

    if (product.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    const wishlistResult = await client.query(
      `
      SELECT id
      FROM wishlists
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    let wishlistId;

    if (wishlistResult.rows.length > 0) {
      wishlistId = wishlistResult.rows[0].id;
    } else {
      const created = await client.query(
        `
        INSERT INTO wishlists (user_id)
        VALUES ($1)
        RETURNING id
        `,
        [req.user.id]
      );

      wishlistId = created.rows[0].id;
    }

    const existing = await client.query(
      `
      SELECT id
      FROM wishlist_items
      WHERE wishlist_id = $1
        AND product_id = $2
      `,
      [wishlistId, productId]
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Product is already in your wishlist.",
        already_exists: true
      });
    }

    await client.query(
      `
      INSERT INTO wishlist_items
        (wishlist_id, product_id)
      VALUES
        ($1, $2)
      `,
      [wishlistId, productId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Product added to wishlist."
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Wishlist add error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist."
    });

  } finally {
    client.release();
  }
});

// DELETE /api/wishlist/:productId
router.delete("/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await pool.query(
      `
      SELECT id
      FROM wishlists
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    if (wishlist.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found."
      });
    }

    const result = await pool.query(
      `
      DELETE FROM wishlist_items
      WHERE wishlist_id = $1
        AND product_id = $2
      RETURNING id
      `,
      [wishlist.rows[0].id, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product is not in your wishlist."
      });
    }

    res.json({
      success: true,
      message: "Product removed from wishlist."
    });

  } catch (error) {
    console.error("Wishlist remove error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist."
    });
  }
});

module.exports = router;