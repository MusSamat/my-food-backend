const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
    const { code, type, value, min_order, max_uses, valid_from, valid_to, is_active } = req.body;
    if (!code || !type || !value) throw new AppError('code, type, value обязательны', 400);
    const { rows } = await pool.query(
        `INSERT INTO promo_codes (code, type, value, min_order, max_uses, valid_from, valid_to, is_active)
         VALUES (UPPER($1),$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [code, type, parseInt(value), min_order || 0, max_uses || null, valid_from || null, valid_to || null, is_active ?? true]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { code, type, value, min_order, max_uses, valid_from, valid_to, is_active } = req.body;
    const { rows } = await pool.query(
        `UPDATE promo_codes SET code=UPPER($1), type=$2, value=$3, min_order=$4, max_uses=$5,
         valid_from=$6, valid_to=$7, is_active=$8 WHERE id=$9 RETURNING *`,
        [code, type, value, min_order, max_uses, valid_from, valid_to, is_active, req.params.id]
    );
    if (!rows.length) throw new AppError('Промокод не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM promo_codes WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Промокод не найден', 404);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;
