const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

// GET /api/settings — public (global restaurant info)
router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM restaurant_settings ORDER BY id LIMIT 1');
    const settings = rows[0] || {
        restaurant_name: 'Food Delivery', currency: 'сом',
        logo_url: null, contact_phone: null, contact_email: null,
        telegram_channel: null, about_text: null,
    };
    res.json({ success: true, data: settings });
}));

// PUT /api/admin/settings — admin only (global settings)
router.put('/', authMiddleware, asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin') {
        const { AppError } = require('../../middleware/errorHandler');
        throw new AppError('Только суперадмин', 403);
    }

    const { restaurant_name, currency, logo_url, contact_phone, contact_email, telegram_channel, about_text } = req.body;

    const { rows: existing } = await pool.query('SELECT id FROM restaurant_settings ORDER BY id LIMIT 1');

    let result;
    if (existing.length) {
        result = await pool.query(
            `UPDATE restaurant_settings SET
                                            restaurant_name=$1, currency=$2, logo_url=$3,
                                            contact_phone=$4, contact_email=$5, telegram_channel=$6, about_text=$7
             WHERE id=$8 RETURNING *`,
            [restaurant_name || 'Food Delivery', currency || 'сом', logo_url || null,
                contact_phone || null, contact_email || null, telegram_channel || null,
                about_text || null, existing[0].id]
        );
    } else {
        result = await pool.query(
            `INSERT INTO restaurant_settings (restaurant_name, currency, logo_url, contact_phone, contact_email, telegram_channel, about_text)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [restaurant_name || 'Food Delivery', currency || 'сом', logo_url || null,
                contact_phone || null, contact_email || null, telegram_channel || null, about_text || null]
        );
    }

    res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;