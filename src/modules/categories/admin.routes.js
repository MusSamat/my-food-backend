const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM categories ORDER BY sort_order');
    res.json({ success: true, data: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
    const { name_ru, name_kg, icon, sort_order, is_active } = req.body;
    if (!name_ru) throw new AppError('name_ru обязательно', 400);
    const { rows } = await pool.query(
        `INSERT INTO categories (name_ru, name_kg, icon, sort_order, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name_ru, name_kg || null, icon || null, sort_order || 0, is_active ?? true]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { name_ru, name_kg, icon, sort_order, is_active } = req.body;
    const { rows } = await pool.query(
        `UPDATE categories SET name_ru=$1, name_kg=$2, icon=$3, sort_order=$4, is_active=$5 WHERE id=$6 RETURNING *`,
        [name_ru, name_kg, icon, sort_order, is_active, req.params.id]
    );
    if (!rows.length) throw new AppError('Категория не найдена', 404);
    res.json({ success: true, data: rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Категория не найдена', 404);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;
