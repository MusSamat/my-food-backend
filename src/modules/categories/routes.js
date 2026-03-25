const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

// ═══ PUBLIC ═══

// GET /api/categories — список категорий с блюдами
router.get('/', asyncHandler(async (req, res) => {
    const { rows: categories } = await pool.query(`
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
        ORDER BY c.sort_order
    `);

    res.json({ success: true, data: categories });
}));

// ═══ ADMIN ═══

// GET /api/admin/categories
router.get('/admin', authMiddleware, asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY sort_order');
    res.json({ success: true, data: rows });
}));

// POST /api/admin/categories
router.post('/admin', authMiddleware, asyncHandler(async (req, res) => {
    const { name_ru, name_kg, icon, sort_order, is_active } = req.body;

    if (!name_ru) throw new AppError('name_ru обязательно', 400);

    const { rows } = await pool.query(
        `INSERT INTO categories (name_ru, name_kg, icon, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name_ru, name_kg || null, icon || null, sort_order || 0, is_active ?? true]
    );

    res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/admin/categories/:id
router.put('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { name_ru, name_kg, icon, sort_order, is_active } = req.body;

    const { rows } = await pool.query(
        `UPDATE categories SET name_ru = $1, name_kg = $2, icon = $3, sort_order = $4, is_active = $5
         WHERE id = $6 RETURNING *`,
        [name_ru, name_kg, icon, sort_order, is_active, req.params.id]
    );

    if (!rows.length) throw new AppError('Категория не найдена', 404);
    res.json({ success: true, data: rows[0] });
}));

// DELETE /api/admin/categories/:id
router.delete('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Категория не найдена', 404);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;
