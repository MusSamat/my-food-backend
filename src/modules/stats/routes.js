const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => {
    const { branch_id: queryBranch } = req.query;

    // Operator: only their branch. Superadmin: selected branch or all
    let branchId = null;
    if (req.admin.role !== 'superadmin' && req.admin.branch_id) {
        branchId = req.admin.branch_id;
    } else if (queryBranch) {
        branchId = queryBranch;
    }

    const bf = branchId ? `AND o.branch_id = ${parseInt(branchId)}` : '';
    const paidFilter = `o.status NOT IN ('pending_payment', 'cancelled') ${bf}`;

    const { rows: [today] } = await pool.query(`SELECT COUNT(*)::int as count, COALESCE(SUM(o.total),0)::int as sum FROM orders o WHERE o.created_at >= CURRENT_DATE AND ${paidFilter}`);
    const { rows: [week] } = await pool.query(`SELECT COUNT(*)::int as count, COALESCE(SUM(o.total),0)::int as sum FROM orders o WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 days' AND ${paidFilter}`);
    const { rows: [month] } = await pool.query(`SELECT COUNT(*)::int as count, COALESCE(SUM(o.total),0)::int as sum FROM orders o WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days' AND ${paidFilter}`);
    const { rows: [avg] } = await pool.query(`SELECT COALESCE(ROUND(AVG(o.total)),0)::int as avg_check FROM orders o WHERE ${paidFilter} AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'`);

    const { rows: topItems } = await pool.query(`
        SELECT oi.item_name, SUM(oi.quantity)::int as total_qty, SUM(oi.quantity*oi.price_at_order)::int as total_sum
        FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE ${paidFilter} AND o.created_at >= CURRENT_DATE-INTERVAL '30 days'
        GROUP BY oi.item_name ORDER BY total_qty DESC LIMIT 10
    `);

    const { rows: dailyOrders } = await pool.query(`
        SELECT DATE(o.created_at) as date, COUNT(*)::int as count, COALESCE(SUM(o.total),0)::int as sum
        FROM orders o WHERE ${paidFilter} AND o.created_at >= CURRENT_DATE-INTERVAL '14 days'
        GROUP BY DATE(o.created_at) ORDER BY date
    `);

    const { rows: byCategory } = await pool.query(`
        SELECT c.name_ru as category, SUM(oi.quantity)::int as total_qty
        FROM order_items oi JOIN items i ON i.id=oi.item_id JOIN categories c ON c.id=i.category_id JOIN orders o ON o.id=oi.order_id
        WHERE ${paidFilter} AND o.created_at >= CURRENT_DATE-INTERVAL '30 days'
        GROUP BY c.name_ru ORDER BY total_qty DESC
    `);

    const { rows: [active] } = await pool.query(`SELECT COUNT(*)::int as count FROM orders o WHERE o.status NOT IN ('delivered','cancelled','pending_payment') ${bf}`);

    res.json({
        success: true,
        data: {
            today: { orders: today.count, revenue: today.sum },
            week: { orders: week.count, revenue: week.sum },
            month: { orders: month.count, revenue: month.sum },
            avg_check: avg.avg_check, active_orders: active.count,
            top_items: topItems, daily_orders: dailyOrders, by_category: byCategory,
        },
    });
}));

module.exports = router;