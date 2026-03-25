const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

// GET /api/offices
router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM offices WHERE is_active = true ORDER BY name'
    );
    res.json({ success: true, data: rows });
}));

// GET /api/admin/offices
router.get('/admin', authMiddleware, asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM offices ORDER BY id');
    res.json({ success: true, data: rows });
}));

// POST /api/admin/offices
router.post('/admin', authMiddleware, asyncHandler(async (req, res) => {
    const { name, address, phone, working_hours, is_active } = req.body;
    if (!name || !address) throw new AppError('name и address обязательны', 400);

    const { rows } = await pool.query(
        `INSERT INTO offices (name, address, phone, working_hours, is_active)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name, address, phone, working_hours, is_active ?? true]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/admin/offices/:id
router.put('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { name, address, phone, working_hours, is_active } = req.body;
    const { rows } = await pool.query(
        `UPDATE offices SET name=$1, address=$2, phone=$3, working_hours=$4, is_active=$5
         WHERE id=$6 RETURNING *`,
        [name, address, phone, working_hours, is_active, req.params.id]
    );
    if (!rows.length) throw new AppError('Офис не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

// DELETE /api/admin/offices/:id
router.delete('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM offices WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Офис не найден', 404);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;
