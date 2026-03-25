const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');
const { upload, processImage } = require('../../middleware/upload');

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => {
    const { category_id, status } = req.query;
    let query = 'SELECT i.*, c.name_ru as category_name FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE 1=1';
    const params = [];
    if (category_id) { params.push(category_id); query += ` AND i.category_id = $${params.length}`; }
    if (status) { params.push(status); query += ` AND i.status = $${params.length}`; }
    query += ' ORDER BY i.category_id, i.sort_order';
    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
}));

router.post('/', upload.single('image'), asyncHandler(async (req, res) => {
    const { name_ru, name_kg, description_ru, description_kg, ingredients, price, category_id, status, is_popular, sort_order } = req.body;
    if (!name_ru || !price || !category_id) throw new AppError('name_ru, price и category_id обязательны', 400);

    let image_url = null;
    if (req.file) image_url = await processImage(req.file);

    const { rows } = await pool.query(
        `INSERT INTO items (name_ru, name_kg, description_ru, description_kg, ingredients, price, image_url, category_id, status, is_popular, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [name_ru, name_kg, description_ru, description_kg, ingredients,
         parseInt(price), image_url, parseInt(category_id),
         status || 'available', is_popular === 'true' || is_popular === true, parseInt(sort_order) || 0]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/:id', upload.single('image'), asyncHandler(async (req, res) => {
    const { name_ru, name_kg, description_ru, description_kg, ingredients, price, category_id, status, is_popular, sort_order } = req.body;

    let image_url = undefined;
    if (req.file) image_url = await processImage(req.file);

    const setClauses = [];
    const params = [];
    const add = (f, v) => { if (v !== undefined) { params.push(v); setClauses.push(`${f} = $${params.length}`); } };

    add('name_ru', name_ru); add('name_kg', name_kg); add('description_ru', description_ru);
    add('description_kg', description_kg); add('ingredients', ingredients);
    add('price', price ? parseInt(price) : undefined); add('category_id', category_id ? parseInt(category_id) : undefined);
    add('status', status); add('is_popular', is_popular !== undefined ? (is_popular === 'true' || is_popular === true) : undefined);
    add('sort_order', sort_order !== undefined ? parseInt(sort_order) : undefined); add('image_url', image_url);

    if (!setClauses.length) throw new AppError('Нет данных для обновления', 400);

    params.push(req.params.id);
    const { rows } = await pool.query(`UPDATE items SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) throw new AppError('Блюдо не найдено', 404);
    res.json({ success: true, data: rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Блюдо не найдено', 404);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;
