const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');

const router = Router();

router.get('/:telegramId', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT i.* FROM favorites f
                            JOIN items i ON i.id = f.item_id
        WHERE f.telegram_id = $1 AND i.status != 'hidden'
        ORDER BY f.created_at DESC
    `, [req.params.telegramId]);
    res.json({ success: true, data: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
    const { telegram_id, item_id } = req.body;
    if (!telegram_id || !item_id) throw new AppError('telegram_id и item_id обязательны', 400);

    const { rows: existing } = await pool.query(
        'SELECT id FROM favorites WHERE telegram_id = $1 AND item_id = $2',
        [telegram_id, item_id]
    );

    if (existing.length) {
        await pool.query('DELETE FROM favorites WHERE telegram_id = $1 AND item_id = $2', [telegram_id, item_id]);
        res.json({ success: true, data: { favorited: false } });
    } else {
        await pool.query('INSERT INTO favorites (telegram_id, item_id) VALUES ($1, $2)', [telegram_id, item_id]);
        res.json({ success: true, data: { favorited: true } });
    }
}));

module.exports = router;