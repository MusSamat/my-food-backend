const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');

const router = Router();

// GET /api/users/:telegramId
router.get('/:telegramId', asyncHandler(async (req, res) => {
    const { telegramId } = req.params;
    const { rows } = await pool.query(
        'SELECT * FROM telegram_users WHERE telegram_id = $1',
        [telegramId]
    );
    res.json({ success: true, data: rows[0] || null });
}));

// POST /api/users — create or update
router.post('/', asyncHandler(async (req, res) => {
    const {
        telegram_id, username, first_name, last_name,
        phone, birthday, office_phone,
        saved_address, saved_apartment, saved_floor, saved_entrance, saved_office_id,
        latitude, longitude, location_address,
    } = req.body;

    if (!telegram_id) throw new AppError('telegram_id обязателен', 400);

    const { rows: existing } = await pool.query(
        'SELECT id FROM telegram_users WHERE telegram_id = $1',
        [telegram_id]
    );

    let result;
    if (existing.length) {
        const sets = [];
        const params = [];
        const add = (field, value) => {
            if (value !== undefined && value !== null && value !== '') {
                params.push(value);
                sets.push(`${field} = $${params.length}`);
            }
        };

        add('username', username);
        add('first_name', first_name);
        add('last_name', last_name);
        add('phone', phone);
        add('birthday', birthday);
        add('office_phone', office_phone);
        add('saved_address', saved_address);
        add('saved_apartment', saved_apartment);
        add('saved_floor', saved_floor);
        add('saved_entrance', saved_entrance);
        add('saved_office_id', saved_office_id);
        add('latitude', latitude);
        add('longitude', longitude);
        add('location_address', location_address);

        if (sets.length) {
            params.push(telegram_id);
            result = await pool.query(
                `UPDATE telegram_users SET ${sets.join(', ')} WHERE telegram_id = $${params.length} RETURNING *`,
                params
            );
        } else {
            result = await pool.query('SELECT * FROM telegram_users WHERE telegram_id = $1', [telegram_id]);
        }
    } else {
        result = await pool.query(
            `INSERT INTO telegram_users (telegram_id, username, first_name, last_name, phone, birthday, office_phone,
                saved_address, saved_apartment, saved_floor, saved_entrance, saved_office_id,
                latitude, longitude, location_address)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [telegram_id, username || null, first_name || null, last_name || null,
                phone || null, birthday || null, office_phone || null,
                saved_address || null, saved_apartment || null, saved_floor || null,
                saved_entrance || null, saved_office_id || null,
                latitude || null, longitude || null, location_address || null]
        );
    }

    res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;