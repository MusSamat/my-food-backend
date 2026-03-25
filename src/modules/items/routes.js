const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');
const { upload, processImage } = require('../../middleware/upload');

const router = Router();

// ═══ PUBLIC ═══

// GET /api/items?category_id=X
router.get('/', asyncHandler(async (req, res) => {
    const { category_id } = req.query;
    let query = `SELECT * FROM items WHERE status != 'hidden'`;
    const params = [];

    if (category_id) {
        params.push(category_id);
        query += ` AND category_id = $${params.length}`;
    }

    query += ' ORDER BY sort_order';
    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
}));

// GET /api/items/popular
router.get('/popular', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT * FROM items
        WHERE is_popular = true AND status = 'available'
        ORDER BY sort_order LIMIT 10
    `);
    res.json({ success: true, data: rows });
}));

// GET /api/items/search?q=text
router.get('/search', asyncHandler(async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) {
        return res.json({ success: true, data: [] });
    }

    const pattern = `%${q}%`;
    const { rows } = await pool.query(`
        SELECT * FROM items
        WHERE status != 'hidden'
          AND (name_ru ILIKE $1 OR name_kg ILIKE $1 OR description_ru ILIKE $1 OR ingredients ILIKE $1)
        ORDER BY sort_order LIMIT 30
    `, [pattern]);

    res.json({ success: true, data: rows });
}));

// GET /api/items/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id]);
    if (!rows.length) throw new AppError('Блюдо не найдено', 404);
    res.json({ success: true, data: rows[0] });
}));

// ═══ ADMIN ═══

// GET /api/admin/items
router.get('/admin/list', authMiddleware, asyncHandler(async (req, res) => {
    const { category_id, status } = req.query;
    let query = 'SELECT i.*, c.name_ru as category_name FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE 1=1';
    const params = [];

    if (category_id) {
        params.push(category_id);
        query += ` AND i.category_id = $${params.length}`;
    }
    if (status) {
        params.push(status);
        query += ` AND i.status = $${params.length}`;
    }

    query += ' ORDER BY i.category_id, i.sort_order';
    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
}));

// POST /api/admin/items
router.post('/admin', authMiddleware, upload.single('image'), asyncHandler(async (req, res) => {
    const { name_ru, name_kg, description_ru, description_kg, ingredients, price, category_id, status, is_popular, sort_order } = req.body;

    if (!name_ru || !price || !category_id) {
        throw new AppError('name_ru, price и category_id обязательны', 400);
    }

    let image_url = null;
    if (req.file) {
        image_url = await processImage(req.file);
    }

    const { rows } = await pool.query(
        `INSERT INTO items (name_ru, name_kg, description_ru, description_kg, ingredients, price, image_url, category_id, status, is_popular, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [name_ru, name_kg, description_ru, description_kg, ingredients,
         parseInt(price), image_url, parseInt(category_id),
         status || 'available', is_popular === 'true' || is_popular === true, parseInt(sort_order) || 0]
    );

    res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/admin/items/:id
router.put('/admin/:id', authMiddleware, upload.single('image'), asyncHandler(async (req, res) => {
    const { name_ru, name_kg, description_ru, description_kg, ingredients, price, category_id, status, is_popular, sort_order } = req.body;

    let image_url = undefined;
    if (req.file) {
        image_url = await processImage(req.file);
    }

    const setClauses = [];
    const params = [];
    const addField = (field, value) => {
        if (value !== undefined) {
            params.push(value);
            setClauses.push(`${field} = $${params.length}`);
        }
    };

    addField('name_ru', name_ru);
    addField('name_kg', name_kg);
    addField('description_ru', description_ru);
    addField('description_kg', description_kg);
    addField('ingredients', ingredients);
    addField('price', price ? parseInt(price) : undefined);
    addField('category_id', category_id ? parseInt(category_id) : undefined);
    addField('status', status);
    addField('is_popular', is_popular !== undefined ? (is_popular === 'true' || is_popular === true) : undefined);
    addField('sort_order', sort_order !== undefined ? parseInt(sort_order) : undefined);
    addField('image_url', image_url);

    if (!setClauses.length) throw new AppError('Нет данных для обновления', 400);

    params.push(req.params.id);
    const { rows } = await pool.query(
        `UPDATE items SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
    );

    if (!rows.length) throw new AppError('Блюдо не найдено', 404);
    res.json({ success: true, data: rows[0] });
}));

// DELETE /api/admin/items/:id
router.delete('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Блюдо не найдено', 404);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;
