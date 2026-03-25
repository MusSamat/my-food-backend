const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const { createPayment } = require('../payments/service');
const { autoPrintIfEnabled } = require('../print/service');

const router = Router();

// POST /api/orders
router.post('/', asyncHandler(async (req, res) => {
    const {
        telegram_user_id, telegram_username,
        type, name, phone,
        address, apartment, floor, entrance, courier_comment,
        office_id, comment, cutlery_count,
        items, promo_code,
    } = req.body;

    if (!telegram_user_id) throw new AppError('telegram_user_id обязателен', 400);
    if (!name || !phone) throw new AppError('Имя и телефон обязательны', 400);
    if (!items || !items.length) throw new AppError('Корзина пуста', 400);
    if (type === 'delivery' && !address) throw new AppError('Укажите адрес доставки', 400);

    const result = await pool.transaction(async (client) => {
        const itemIds = items.map(i => i.id);
        const { rows: dbItems } = await client.query(
            `SELECT id, name_ru, price, status FROM items WHERE id = ANY($1)`,
            [itemIds]
        );

        const itemMap = new Map(dbItems.map(i => [i.id, i]));
        let subtotal = 0;
        const orderItems = [];

        for (const cartItem of items) {
            const dbItem = itemMap.get(cartItem.id);
            if (!dbItem) throw new AppError(`Блюдо id=${cartItem.id} не найдено`, 400);
            if (dbItem.status !== 'available') throw new AppError(`"${dbItem.name_ru}" недоступно для заказа`, 400);

            const qty = Math.max(1, parseInt(cartItem.quantity) || 1);
            subtotal += dbItem.price * qty;
            orderItems.push({ item_id: dbItem.id, item_name: dbItem.name_ru, quantity: qty, price_at_order: dbItem.price });
        }

        let discount = 0, promoId = null, promoCodeStr = null;
        if (promo_code) {
            const { rows: promos } = await client.query(
                `SELECT * FROM promo_codes WHERE code = UPPER($1) AND is_active = true
                 AND (valid_from IS NULL OR valid_from <= NOW()) AND (valid_to IS NULL OR valid_to >= NOW())`,
                [promo_code]
            );
            if (promos.length) {
                const promo = promos[0];
                if ((!promo.max_uses || promo.used_count < promo.max_uses) && (!promo.min_order || subtotal >= promo.min_order)) {
                    discount = promo.type === 'percent' ? Math.round(subtotal * promo.value / 100) : promo.value;
                    discount = Math.min(discount, subtotal);
                    promoId = promo.id;
                    promoCodeStr = promo.code;
                    await client.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promo.id]);
                }
            }
        }

        const deliveryFee = type === 'delivery' ? 150 : 0;
        const total = subtotal - discount + deliveryFee;

        const { rows: [order] } = await client.query(
            `INSERT INTO orders (telegram_user_id, telegram_username, type, name, phone,
                address, apartment, floor, entrance, courier_comment,
                office_id, comment, cutlery_count,
                subtotal, discount, delivery_fee, total,
                promo_id, promo_code, status, payment_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending_payment','pending')
             RETURNING *`,
            [telegram_user_id, telegram_username || null, type || 'delivery', name, phone,
             address || null, apartment || null, floor || null, entrance || null, courier_comment || null,
             office_id || null, comment || null, cutlery_count || 1,
             subtotal, discount, deliveryFee, total, promoId, promoCodeStr]
        );

        for (const oi of orderItems) {
            await client.query(
                `INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order) VALUES ($1,$2,$3,$4,$5)`,
                [order.id, oi.item_id, oi.item_name, oi.quantity, oi.price_at_order]
            );
        }

        await client.query(
            `INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, 'pending_payment', 'system')`,
            [order.id]
        );

        return { order, orderItems };
    });

    try {
        // const { paymentId, paymentUrl } = await createPayment({
        //     amount: result.order.total, orderId: result.order.id, description: `Заказ #${result.order.id}`,
        // });

        const paymentUrl = 'https://finik.kg/test-payment';
        const paymentId = 'test_fake_id_123';

        await pool.query('UPDATE orders SET payment_id = $1, payment_url = $2 WHERE id = $3',
            [paymentId, paymentUrl, result.order.id]);

        res.status(201).json({ success: true, data: { order_id: result.order.id, total: result.order.total, payment_url: paymentUrl } });
    } catch (err) {
        await pool.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [result.order.id]);
        throw new AppError('Ошибка создания платежа: ' + err.message, 502);
    }
}));


// GET /api/orders/history/:telegramId
router.get('/history/:telegramId', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT o.id, o.status, o.total, o.type, o.address, o.created_at,
            COALESCE(json_agg(
                json_build_object('item_id', oi.item_id, 'item_name', oi.item_name,
                    'quantity', oi.quantity, 'price', oi.price_at_order)
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.telegram_user_id = $1
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 50
    `, [req.params.telegramId]);

    res.json({ success: true, data: rows });
}));

// GET /api/orders/:id/status
router.get('/:id/status', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        `SELECT o.id, o.status, o.payment_status, o.total, o.type, o.created_at,
            json_agg(json_build_object('item_name', oi.item_name, 'quantity', oi.quantity, 'price', oi.price_at_order)) as items
         FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = $1 GROUP BY o.id`,
        [req.params.id]
    );
    if (!rows.length) throw new AppError('Заказ не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

module.exports = router;
