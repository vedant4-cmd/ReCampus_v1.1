const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

// Get or create the default comparison list
async function getOrCreateComparison(userId) {
  const existing = await pool.query(
    `
    SELECT id
    FROM comparison_lists
    WHERE user_id = $1
    ORDER BY id ASC
    LIMIT 1
    `,
    [userId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const created = await pool.query(
    `
    INSERT INTO comparison_lists
      (user_id, name)
    VALUES
      ($1, 'My Comparison')
    RETURNING id
    `,
    [userId]
  );

  return created.rows[0].id;
}

// GET /api/comparison
router.get("/", authMiddleware, async (req, res) => {
  try {
    const comparisonId = await getOrCreateComparison(req.user.id);

    const result = await pool.query(
      `
      SELECT
        ci.id AS comparison_item_id,

        p.id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.original_price,
        p.condition,
        p.status,

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

      FROM comparison_items ci

      INNER JOIN products p
        ON p.id = ci.product_id

      LEFT JOIN categories c
        ON c.id = p.category_id

      LEFT JOIN colleges col
        ON col.id = p.college_id

      INNER JOIN users u
        ON u.id = p.seller_id

      LEFT JOIN inventory i
        ON i.product_id = p.id

      WHERE ci.comparison_id = $1

      ORDER BY ci.created_at ASC
      `,
      [comparisonId]
    );

    res.json({
      success: true,
      comparison_id: comparisonId,
      count: result.rows.length,
      items: result.rows
    });

  } catch (error) {
    console.error("Comparison GET error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load comparison."
    });
  }
});

// POST /api/comparison/:productId
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

    const comparisonResult = await client.query(
      `
      SELECT id
      FROM comparison_lists
      WHERE user_id = $1
      ORDER BY id ASC
      LIMIT 1
      `,
      [req.user.id]
    );

    let comparisonId;

    if (comparisonResult.rows.length > 0) {
      comparisonId = comparisonResult.rows[0].id;
    } else {
      const created = await client.query(
        `
        INSERT INTO comparison_lists
          (user_id, name)
        VALUES
          ($1, 'My Comparison')
        RETURNING id
        `,
        [req.user.id]
      );

      comparisonId = created.rows[0].id;
    }

    const existing = await client.query(
      `
      SELECT id
      FROM comparison_items
      WHERE comparison_id = $1
        AND product_id = $2
      `,
      [comparisonId, productId]
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Product is already in comparison.",
        already_exists: true
      });
    }

    // Keep comparison manageable.
    const countResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM comparison_items
      WHERE comparison_id = $1
      `,
      [comparisonId]
    );

    if (countResult.rows[0].count >= 4) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "You can compare up to 4 products at a time."
      });
    }

    await client.query(
      `
      INSERT INTO comparison_items
        (comparison_id, product_id)
      VALUES
        ($1, $2)
      `,
      [comparisonId, productId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Product added to comparison."
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Comparison add error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add product to comparison."
    });

  } finally {
    client.release();
  }
});

// DELETE /api/comparison/:productId
router.delete("/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;

    const comparison = await pool.query(
      `
      SELECT id
      FROM comparison_lists
      WHERE user_id = $1
      ORDER BY id ASC
      LIMIT 1
      `,
      [req.user.id]
    );

    if (comparison.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Comparison list not found."
      });
    }

    const result = await pool.query(
      `
      DELETE FROM comparison_items
      WHERE comparison_id = $1
        AND product_id = $2
      RETURNING id
      `,
      [comparison.rows[0].id, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product is not in comparison."
      });
    }

    res.json({
      success: true,
      message: "Product removed from comparison."
    });

  } catch (error) {
    console.error("Comparison remove error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to remove product from comparison."
    });
  }
});

module.exports = router;