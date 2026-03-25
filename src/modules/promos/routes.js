const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

// POST /api/promo/validate
router.post('/validate', asyncHandler(async (req, res) => {
    const { code, subtotal } = req.body;

    if (!code) throw new AppError('Введите промокод', 400);

    const { rows } = await pool.query(
        `SELECT * FROM promo_codes
         WHERE code = UPPER($1) AND is_active = true
           AND (valid_from IS NULL OR valid_from <= NOW())
           AND (valid_to IS NULL OR valid_to >= NOW())`,
        [code]
    );

    if (!rows.length) throw new AppError('Промокод не найден или истёк', 404);

    const promo = rows[0];

    if (promo.max_uses && promo.used_count >= promo.max_uses) {
        throw new AppError('Промокод исчерпан', 400);
    }

    if (promo.min_order && subtotal < promo.min_order) {
        throw new AppError(`Минимальная сумма заказа: ${promo.min_order} сом`, 400);
    }

    let discount = 0;
    if (promo.type === 'percent') {
        discount = Math.round(subtotal * promo.value / 100);
    } else {
        discount = promo.value;
    }
    discount = Math.min(discount, subtotal);

    res.json({
        success: true,
        data: {
            id: promo.id,
            code: promo.code,
            type: promo.type,
            value: promo.value,
            discount,
        },
    });
}));

// ═══ ADMIN ═══

// GET /api/admin/promos
router.get('/admin', authMiddleware, asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
}));

// POST /api/admin/promos
router.post('/admin', authMiddleware, asyncHandler(async (req, res) => {
    const { code, type, value, min_order, max_uses, valid_from, valid_to, is_active } = req.body;

    if (!code || !type || !value) throw new AppError('code, type, value обязательны', 400);

    const { rows } = await pool.query(
        `INSERT INTO promo_codes (code, type, value, min_order, max_uses, valid_from, valid_to, is_active)
         VALUES (UPPER($1),$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [code, type, parseInt(value), min_order || 0, max_uses || null, valid_from || null, valid_to || null, is_active ?? true]
    );

    res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/admin/promos/:id
router.put('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { code, type, value, min_order, max_uses, valid_from, valid_to, is_active } = req.body;

    const { rows } = await pool.query(
        `UPDATE promo_codes SET code=UPPER($1), type=$2, value=$3, min_order=$4, max_uses=$5,
         valid_from=$6, valid_to=$7, is_active=$8 WHERE id=$9 RETURNING *`,
        [code, type, value, min_order, max_uses, valid_from, valid_to, is_active, req.params.id]
    );

    if (!rows.length) throw new AppError('Промокод не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

// DELETE /api/admin/promos/:id
router.delete('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM promo_codes WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Промокод не найден', 404);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;
