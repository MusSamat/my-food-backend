const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
    const { order_id, telegram_id, rating, comment } = req.body;
    if (!order_id || !telegram_id || !rating) throw new AppError('order_id, telegram_id, rating обязательны', 400);
    if (rating < 1 || rating > 5) throw new AppError('Рейтинг от 1 до 5', 400);

    const { rows: [order] } = await pool.query(
        'SELECT id, status FROM orders WHERE id = $1 AND telegram_user_id = $2',
        [order_id, telegram_id]
    );
    if (!order) throw new AppError('Заказ не найден', 404);
    if (order.status !== 'delivered') throw new AppError('Можно оценить только доставленный заказ', 400);

    const { rows } = await pool.query(
        `INSERT INTO reviews (order_id, telegram_id, rating, comment)
         VALUES ($1,$2,$3,$4) ON CONFLICT (order_id) DO UPDATE SET rating=$3, comment=$4 RETURNING *`,
        [order_id, telegram_id, rating, comment || null]
    );
    res.json({ success: true, data: rows[0] });
}));

router.get('/:orderId', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM reviews WHERE order_id = $1', [req.params.orderId]);
    res.json({ success: true, data: rows[0] || null });
}));

module.exports = router;