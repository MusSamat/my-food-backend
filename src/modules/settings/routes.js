const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM restaurant_settings ORDER BY id LIMIT 1');
    const settings = rows[0] || {
        delivery_fee: 150, min_order_amount: 0,
        working_hours_from: '10:00', working_hours_to: '23:00', is_open: true,
    };

    let isCurrentlyOpen = false;

    if (!settings.is_open) {
        isCurrentlyOpen = false;
    } else if (settings.working_hours_from === '00:00' && settings.working_hours_to === '23:59') {
        // 24/7 mode
        isCurrentlyOpen = true;
    } else {
        const now = new Date();
        const bishkekOffset = 6;
        const localHours = (now.getUTCHours() + bishkekOffset) % 24;
        const current = `${String(localHours).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
        isCurrentlyOpen = current >= settings.working_hours_from && current <= settings.working_hours_to;
    }

    res.json({
        success: true,
        data: { ...settings, is_currently_open: isCurrentlyOpen },
    });
}));

router.put('/', authMiddleware, asyncHandler(async (req, res) => {
    const { delivery_fee, min_order_amount, working_hours_from, working_hours_to, is_open } = req.body;

    const { rows: existing } = await pool.query('SELECT id FROM restaurant_settings ORDER BY id LIMIT 1');

    let result;
    if (existing.length) {
        result = await pool.query(
            `UPDATE restaurant_settings SET
                                            delivery_fee=$1, min_order_amount=$2, working_hours_from=$3, working_hours_to=$4, is_open=$5
             WHERE id=$6 RETURNING *`,
            [delivery_fee ?? 150, min_order_amount ?? 0, working_hours_from ?? '10:00',
                working_hours_to ?? '23:00', is_open ?? true, existing[0].id]
        );
    } else {
        result = await pool.query(
            `INSERT INTO restaurant_settings (delivery_fee, min_order_amount, working_hours_from, working_hours_to, is_open)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [delivery_fee ?? 150, min_order_amount ?? 0, working_hours_from ?? '10:00',
                working_hours_to ?? '23:00', is_open ?? true]
        );
    }

    res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;