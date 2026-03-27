const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');

const router = Router();

// GET /api/categories?branch_id=X
router.get('/', asyncHandler(async (req, res) => {
    const { branch_id } = req.query;
    let query, params = [];

    if (branch_id) {
        params.push(branch_id);
        query = `
            SELECT c.*,
                COALESCE(json_agg(
                    json_build_object(
                        'id', i.id, 'name_ru', i.name_ru, 'name_kg', i.name_kg,
                        'description_ru', i.description_ru, 'description_kg', i.description_kg,
                        'ingredients', i.ingredients, 'price', i.price,
                        'image_url', i.image_url, 'status', i.status,
                        'is_popular', i.is_popular, 'sort_order', i.sort_order
                    ) ORDER BY i.sort_order
                ) FILTER (WHERE i.id IS NOT NULL AND i.status != 'hidden'), '[]') AS items
            FROM categories c
            JOIN category_branches cb ON cb.category_id = c.id AND cb.branch_id = $1
            LEFT JOIN items i ON i.category_id = c.id
            WHERE c.is_active = true
            GROUP BY c.id
            ORDER BY c.sort_order`;
    } else {
        query = `
            SELECT c.*,
                COALESCE(json_agg(
                    json_build_object(
                        'id', i.id, 'name_ru', i.name_ru, 'name_kg', i.name_kg,
                        'description_ru', i.description_ru, 'description_kg', i.description_kg,
                        'ingredients', i.ingredients, 'price', i.price,
                        'image_url', i.image_url, 'status', i.status,
                        'is_popular', i.is_popular, 'sort_order', i.sort_order
                    ) ORDER BY i.sort_order
                ) FILTER (WHERE i.id IS NOT NULL AND i.status != 'hidden'), '[]') AS items
            FROM categories c
            LEFT JOIN items i ON i.category_id = c.id
            WHERE c.is_active = true
            GROUP BY c.id
            ORDER BY c.sort_order`;
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
}));

module.exports = router;