const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();
router.use(authMiddleware);

// GET /api/admin/users — list with search, pagination
router.get('/', asyncHandler(async (req, res) => {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '';

    if (search && search.trim().length >= 2) {
        params.push(`%${search}%`);
        where = `WHERE (
            u.first_name ILIKE $${params.length} OR
            u.last_name ILIKE $${params.length} OR
            u.username ILIKE $${params.length} OR
            u.phone ILIKE $${params.length} OR
            u.telegram_id::text ILIKE $${params.length}
        )`;
    }

    const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*)::int as count FROM telegram_users u ${where}`, params
    );

    const countParams = params.length;
    params.push(parseInt(limit), offset);

    const { rows } = await pool.query(`
        SELECT u.*,
            (SELECT COUNT(*)::int FROM orders o WHERE o.telegram_user_id = u.telegram_id) as order_count,
            (SELECT COALESCE(SUM(o.total), 0)::int FROM orders o WHERE o.telegram_user_id = u.telegram_id AND o.status NOT IN ('pending_payment', 'cancelled')) as total_spent,
            (SELECT MAX(o.created_at) FROM orders o WHERE o.telegram_user_id = u.telegram_id) as last_order_at
        FROM telegram_users u
        ${where}
        ORDER BY u.created_at DESC
        LIMIT $${countParams + 1} OFFSET $${countParams + 2}
    `, params);

    res.json({
        success: true,
        data: rows,
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    });
}));

// GET /api/admin/users/:id — user detail with orders
router.get('/:id', asyncHandler(async (req, res) => {
    const { rows: [user] } = await pool.query(
        'SELECT * FROM telegram_users WHERE id = $1',
        [req.params.id]
    );
    if (!user) throw new AppError('Пользователь не найден', 404);

    const { rows: orders } = await pool.query(`
        SELECT o.id, o.status, o.total, o.type, o.created_at, o.name, o.phone, o.address,
            COALESCE(json_agg(
                json_build_object('item_name', oi.item_name, 'quantity', oi.quantity, 'price', oi.price_at_order)
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.telegram_user_id = $1
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 50
    `, [user.telegram_id]);

    res.json({ success: true, data: { ...user, orders } });
}));

module.exports = router;