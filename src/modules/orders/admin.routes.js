const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');
const { sendOrderNotification } = require('../telegram/service');

const router = Router();
router.use(authMiddleware);

// Helper: branch filter based on role
const getBranchFilter = (admin, queryBranchId) => {
    if (admin.role === 'superadmin') {
        // Superadmin can filter by branch or see all
        return queryBranchId ? { condition: 'o.branch_id = $', value: queryBranchId } : null;
    } else {
        // Operator sees only their branch
        return admin.branch_id ? { condition: 'o.branch_id = $', value: admin.branch_id } : null;
    }
};

// GET /api/admin/orders
router.get('/', asyncHandler(async (req, res) => {
    const { status, type, date_from, date_to, search, branch_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    // Branch filter
    const branchFilter = getBranchFilter(req.admin, branch_id);
    if (branchFilter) {
        params.push(branchFilter.value);
        conditions.push(`o.branch_id = $${params.length}`);
    }

    if (status) { params.push(status); conditions.push(`o.status = $${params.length}`); }
    if (type) { params.push(type); conditions.push(`o.type = $${params.length}`); }
    if (date_from) { params.push(date_from); conditions.push(`o.created_at >= $${params.length}`); }
    if (date_to) { params.push(date_to); conditions.push(`o.created_at <= $${params.length}`); }
    if (search && search.trim().length >= 1) {
        params.push(`%${search}%`);
        conditions.push(`(o.id::text ILIKE $${params.length} OR o.name ILIKE $${params.length} OR o.phone ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM orders o ${where}`, params);

    params.push(parseInt(limit), offset);
    const { rows } = await pool.query(`
        SELECT o.*, b.name as branch_name,
            COALESCE(json_agg(
                json_build_object('item_name', oi.item_name, 'quantity', oi.quantity, 'price', oi.price_at_order)
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN branches b ON b.id = o.branch_id
        ${where}
        GROUP BY o.id, b.name
        ORDER BY o.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
        success: true,
        data: rows,
        pagination: { total: parseInt(count), page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(parseInt(count) / parseInt(limit)) },
    });
}));

// GET /api/admin/orders/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT o.*, b.name as branch_name,
            COALESCE(json_agg(
                json_build_object('id', oi.id, 'item_id', oi.item_id, 'item_name', oi.item_name,
                    'quantity', oi.quantity, 'price', oi.price_at_order) ORDER BY oi.id
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items,
            off.name as office_name, off.address as office_address
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN offices off ON off.id = o.office_id
        LEFT JOIN branches b ON b.id = o.branch_id
        WHERE o.id = $1
        GROUP BY o.id, off.name, off.address, b.name
    `, [req.params.id]);

    if (!rows.length) throw new AppError('Заказ не найден', 404);

    // Operator can only see their branch's orders
    if (req.admin.role !== 'superadmin' && req.admin.branch_id && rows[0].branch_id !== req.admin.branch_id) {
        throw new AppError('Нет доступа к этому заказу', 403);
    }

    const { rows: history } = await pool.query(
        'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY changed_at',
        [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], status_history: history } });
}));

// PATCH /api/admin/orders/:id/status
router.patch('/:id/status', asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['paid', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) throw new AppError(`Невалидный статус`, 400);

    const { rows: [order] } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!order) throw new AppError('Заказ не найден', 404);

    if (req.admin.role !== 'superadmin' && req.admin.branch_id && order.branch_id !== req.admin.branch_id) {
        throw new AppError('Нет доступа', 403);
    }

    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    await pool.query('INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1,$2,$3)', [req.params.id, status, req.admin.username]);
    sendOrderNotification(order.telegram_user_id, order.id, status).catch(console.error);

    res.json({ success: true, message: `Статус изменён на ${status}` });
}));

module.exports = router;