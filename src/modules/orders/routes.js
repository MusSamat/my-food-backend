const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');
const { createPayment } = require('../payments/service');
const { sendOrderNotification } = require('../telegram/service');
const { autoPrintIfEnabled } = require('../print/service');

const router = Router();

// ═══════════════════════════════════════
// PUBLIC — создание заказа и проверка статуса
// ═══════════════════════════════════════

// POST /api/orders — создание заказа (ТЕСТОВЫЙ РЕЖИМ: БЕЗ ОПЛАТЫ)
router.post('/', asyncHandler(async (req, res) => {
    const {
        telegram_user_id, telegram_username,
        type, name, phone,
        address, apartment, floor, entrance, courier_comment,
        office_id, comment, cutlery_count,
        items, promo_code,
    } = req.body;

    // ─── Валидация ───
    if (!telegram_user_id) throw new AppError('telegram_user_id обязателен', 400);
    if (!name || !phone) throw new AppError('Имя и телефон обязательны', 400);
    if (!items || !items.length) throw new AppError('Корзина пуста', 400);
    if (type === 'delivery' && !address) throw new AppError('Укажите адрес доставки', 400);

    const result = await pool.transaction(async (client) => {
        // ─── Проверяем наличие и цены всех товаров ───
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
            const lineTotal = dbItem.price * qty;
            subtotal += lineTotal;

            orderItems.push({
                item_id: dbItem.id,
                item_name: dbItem.name_ru,
                quantity: qty,
                price_at_order: dbItem.price,
            });
        }

        // ─── Промокод ───
        let discount = 0;
        let promoId = null;
        let promoCodeStr = null;

        if (promo_code) {
            const { rows: promos } = await client.query(
                `SELECT * FROM promo_codes
                 WHERE code = UPPER($1) AND is_active = true
                   AND (valid_from IS NULL OR valid_from <= NOW())
                   AND (valid_to IS NULL OR valid_to >= NOW())`,
                [promo_code]
            );

            if (promos.length) {
                const promo = promos[0];
                if (!promo.max_uses || promo.used_count < promo.max_uses) {
                    if (!promo.min_order || subtotal >= promo.min_order) {
                        discount = promo.type === 'percent'
                            ? Math.round(subtotal * promo.value / 100)
                            : promo.value;
                        discount = Math.min(discount, subtotal);
                        promoId = promo.id;
                        promoCodeStr = promo.code;

                        await client.query(
                            'UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1',
                            [promo.id]
                        );
                    }
                }
            }
        }

        // ─── Доставка ───
        const deliveryFee = type === 'delivery' ? 150 : 0;
        const total = subtotal - discount + deliveryFee;

        // ─── Создание заказа (СТАТУС ИЗМЕНЕН НА 'paid' ДЛЯ ТЕСТОВ) ───
        const { rows: [order] } = await client.query(
            `INSERT INTO orders (
                telegram_user_id, telegram_username, type, name, phone,
                address, apartment, floor, entrance, courier_comment,
                office_id, comment, cutlery_count,
                subtotal, discount, delivery_fee, total,
                promo_id, promo_code, status, payment_status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, 'paid', 'completed')
            RETURNING *`,
            [
                telegram_user_id, telegram_username || null, type || 'delivery',
                name, phone, address || null, apartment || null, floor || null,
                entrance || null, courier_comment || null,
                office_id || null, comment || null, cutlery_count || 1,
                subtotal, discount, deliveryFee, total,
                promoId, promoCodeStr,
            ]
        );

        // ─── Позиции заказа ───
        for (const oi of orderItems) {
            await client.query(
                `INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order)
                 VALUES ($1,$2,$3,$4,$5)`,
                [order.id, oi.item_id, oi.item_name, oi.quantity, oi.price_at_order]
            );
        }

        // ─── История статусов ───
        await client.query(
            `INSERT INTO order_status_history (order_id, status, changed_by)
             VALUES ($1, 'paid', 'system')`,
            [order.id]
        );

        return { order, orderItems };
    });

    // ─── БЛОК ПЛАТЕЖА ЗАКОММЕНТИРОВАН ───
    /*
    try {
        const { paymentId, paymentUrl } = await createPayment({
            amount: result.order.total,
            orderId: result.order.id,
            description: `Заказ #${result.order.id}`,
        });

        await pool.query(
            'UPDATE orders SET payment_id = $1, payment_url = $2 WHERE id = $3',
            [paymentId, paymentUrl, result.order.id]
        );

        res.status(201).json({
            success: true,
            data: {
                order_id: result.order.id,
                total: result.order.total,
                payment_url: paymentUrl,
            },
        });
    } catch (err) {
        await pool.query(
            "UPDATE orders SET status = 'cancelled' WHERE id = $1",
            [result.order.id]
        );
        throw new AppError('Ошибка создания платежа: ' + err.message, 502);
    }
    */

    // ─── ОТВЕТ БЕЗ ПЛАТЕЖНОЙ ССЫЛКИ ───
    res.status(201).json({
        success: true,
        data: {
            order_id: result.order.id,
            total: result.order.total,
            status: result.order.status,
            message: "Test Mode: Order bypasses payment"
        },
    });
}));

// GET /api/orders/:id/status
router.get('/:id/status', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        `SELECT o.id, o.status, o.payment_status, o.total, o.type, o.created_at,
            json_agg(json_build_object(
                'item_name', oi.item_name, 'quantity', oi.quantity,
                'price', oi.price_at_order
            )) as items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = $1
         GROUP BY o.id`,
        [req.params.id]
    );

    if (!rows.length) throw new AppError('Заказ не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

// ═══════════════════════════════════════
// ADMIN — управление заказами
// ═══════════════════════════════════════

// GET /api/admin/orders
router.get('/admin/list', authMiddleware, asyncHandler(async (req, res) => {
    const { status, type, date_from, date_to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (status) {
        params.push(status);
        conditions.push(`o.status = $${params.length}`);
    }
    if (type) {
        params.push(type);
        conditions.push(`o.type = $${params.length}`);
    }
    if (date_from) {
        params.push(date_from);
        conditions.push(`o.created_at >= $${params.length}`);
    }
    if (date_to) {
        params.push(date_to);
        conditions.push(`o.created_at <= $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM orders o ${where}`, params
    );

    params.push(parseInt(limit), offset);
    const { rows } = await pool.query(
        `SELECT o.*,
            COALESCE(json_agg(
                json_build_object('item_name', oi.item_name, 'quantity', oi.quantity, 'price', oi.price_at_order)
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         ${where}
         GROUP BY o.id
         ORDER BY o.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    res.json({
        success: true,
        data: rows,
        pagination: {
            total: parseInt(count),
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(parseInt(count) / parseInt(limit)),
        },
    });
}));

// GET /api/admin/orders/:id
router.get('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        `SELECT o.*,
            COALESCE(json_agg(
                json_build_object('id', oi.id, 'item_id', oi.item_id, 'item_name', oi.item_name,
                    'quantity', oi.quantity, 'price', oi.price_at_order)
                ORDER BY oi.id
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items,
            off.name as office_name, off.address as office_address
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN offices off ON off.id = o.office_id
         WHERE o.id = $1
         GROUP BY o.id, off.name, off.address`,
        [req.params.id]
    );

    if (!rows.length) throw new AppError('Заказ не найден', 404);

    const { rows: history } = await pool.query(
        'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY changed_at',
        [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], status_history: history } });
}));

// PATCH /api/admin/orders/:id/status
router.patch('/admin/:id/status', authMiddleware, asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['paid', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
        throw new AppError(`Невалидный статус. Допустимые: ${validStatuses.join(', ')}`, 400);
    }

    const { rows: [order] } = await pool.query(
        'SELECT * FROM orders WHERE id = $1',
        [req.params.id]
    );
    if (!order) throw new AppError('Заказ не найден', 404);

    await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2',
        [status, req.params.id]
    );

    await pool.query(
        `INSERT INTO order_status_history (order_id, status, changed_by)
         VALUES ($1, $2, $3)`,
        [req.params.id, status, req.admin.username]
    );

    sendOrderNotification(order.telegram_user_id, order.id, status).catch(console.error);

    res.json({ success: true, message: `Статус изменён на ${status}` });
}));

module.exports = router;











// const { Router } = require('express');
// const pool = require('../../db/pool');
// const { asyncHandler, AppError } = require('../../middleware/errorHandler');
// const authMiddleware = require('../../middleware/auth');
// const { createPayment } = require('../payments/service');
// const { sendOrderNotification } = require('../telegram/service');
// const { autoPrintIfEnabled } = require('../print/service');
//
// const router = Router();
//
// // ═══════════════════════════════════════
// // PUBLIC — создание заказа и проверка статуса
// // ═══════════════════════════════════════
//
// // POST /api/orders — создание заказа + инициализация платежа
// router.post('/', asyncHandler(async (req, res) => {
//     const {
//         telegram_user_id, telegram_username,
//         type, name, phone,
//         address, apartment, floor, entrance, courier_comment,
//         office_id, comment, cutlery_count,
//         items, promo_code,
//     } = req.body;
//
//     // ─── Валидация ───
//     if (!telegram_user_id) throw new AppError('telegram_user_id обязателен', 400);
//     if (!name || !phone) throw new AppError('Имя и телефон обязательны', 400);
//     if (!items || !items.length) throw new AppError('Корзина пуста', 400);
//     if (type === 'delivery' && !address) throw new AppError('Укажите адрес доставки', 400);
//
//     const result = await pool.transaction(async (client) => {
//         // ─── Проверяем наличие и цены всех товаров ───
//         const itemIds = items.map(i => i.id);
//         const { rows: dbItems } = await client.query(
//             `SELECT id, name_ru, price, status FROM items WHERE id = ANY($1)`,
//             [itemIds]
//         );
//
//         const itemMap = new Map(dbItems.map(i => [i.id, i]));
//         let subtotal = 0;
//         const orderItems = [];
//
//         for (const cartItem of items) {
//             const dbItem = itemMap.get(cartItem.id);
//             if (!dbItem) throw new AppError(`Блюдо id=${cartItem.id} не найдено`, 400);
//             if (dbItem.status !== 'available') throw new AppError(`"${dbItem.name_ru}" недоступно для заказа`, 400);
//
//             const qty = Math.max(1, parseInt(cartItem.quantity) || 1);
//             const lineTotal = dbItem.price * qty;
//             subtotal += lineTotal;
//
//             orderItems.push({
//                 item_id: dbItem.id,
//                 item_name: dbItem.name_ru,
//                 quantity: qty,
//                 price_at_order: dbItem.price,
//             });
//         }
//
//         // ─── Промокод ───
//         let discount = 0;
//         let promoId = null;
//         let promoCodeStr = null;
//
//         if (promo_code) {
//             const { rows: promos } = await client.query(
//                 `SELECT * FROM promo_codes
//                  WHERE code = UPPER($1) AND is_active = true
//                    AND (valid_from IS NULL OR valid_from <= NOW())
//                    AND (valid_to IS NULL OR valid_to >= NOW())`,
//                 [promo_code]
//             );
//
//             if (promos.length) {
//                 const promo = promos[0];
//                 if (!promo.max_uses || promo.used_count < promo.max_uses) {
//                     if (!promo.min_order || subtotal >= promo.min_order) {
//                         discount = promo.type === 'percent'
//                             ? Math.round(subtotal * promo.value / 100)
//                             : promo.value;
//                         discount = Math.min(discount, subtotal);
//                         promoId = promo.id;
//                         promoCodeStr = promo.code;
//
//                         await client.query(
//                             'UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1',
//                             [promo.id]
//                         );
//                     }
//                 }
//             }
//         }
//
//         // ─── Доставка ───
//         const deliveryFee = type === 'delivery' ? 150 : 0; // TODO: вынести в настройки
//         const total = subtotal - discount + deliveryFee;
//
//         // ─── Создание заказа ───
//         const { rows: [order] } = await client.query(
//             `INSERT INTO orders (
//                 telegram_user_id, telegram_username, type, name, phone,
//                 address, apartment, floor, entrance, courier_comment,
//                 office_id, comment, cutlery_count,
//                 subtotal, discount, delivery_fee, total,
//                 promo_id, promo_code, status, payment_status
//             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending_payment','pending')
//             RETURNING *`,
//             [
//                 telegram_user_id, telegram_username || null, type || 'delivery',
//                 name, phone, address || null, apartment || null, floor || null,
//                 entrance || null, courier_comment || null,
//                 office_id || null, comment || null, cutlery_count || 1,
//                 subtotal, discount, deliveryFee, total,
//                 promoId, promoCodeStr,
//             ]
//         );
//
//         // ─── Позиции заказа ───
//         for (const oi of orderItems) {
//             await client.query(
//                 `INSERT INTO order_items (order_id, item_id, item_name, quantity, price_at_order)
//                  VALUES ($1,$2,$3,$4,$5)`,
//                 [order.id, oi.item_id, oi.item_name, oi.quantity, oi.price_at_order]
//             );
//         }
//
//         // ─── История статусов ───
//         await client.query(
//             `INSERT INTO order_status_history (order_id, status, changed_by)
//              VALUES ($1, 'pending_payment', 'system')`,
//             [order.id]
//         );
//
//         return { order, orderItems };
//     });
//
//     // ─── Создаём платёж в Finik (вне транзакции) ───
//     try {
//         const { paymentId, paymentUrl } = await createPayment({
//             amount: result.order.total,
//             orderId: result.order.id,
//             description: `Заказ #${result.order.id}`,
//         });
//
//         await pool.query(
//             'UPDATE orders SET payment_id = $1, payment_url = $2 WHERE id = $3',
//             [paymentId, paymentUrl, result.order.id]
//         );
//
//         res.status(201).json({
//             success: true,
//             data: {
//                 order_id: result.order.id,
//                 total: result.order.total,
//                 payment_url: paymentUrl,
//             },
//         });
//     } catch (err) {
//         // Если Finik недоступен — заказ создан, но без платежа
//         await pool.query(
//             "UPDATE orders SET status = 'cancelled' WHERE id = $1",
//             [result.order.id]
//         );
//         throw new AppError('Ошибка создания платежа: ' + err.message, 502);
//     }
// }));
//
// // GET /api/orders/:id/status
// router.get('/:id/status', asyncHandler(async (req, res) => {
//     const { rows } = await pool.query(
//         `SELECT o.id, o.status, o.payment_status, o.total, o.type, o.created_at,
//             json_agg(json_build_object(
//                 'item_name', oi.item_name, 'quantity', oi.quantity,
//                 'price', oi.price_at_order
//             )) as items
//          FROM orders o
//          LEFT JOIN order_items oi ON oi.order_id = o.id
//          WHERE o.id = $1
//          GROUP BY o.id`,
//         [req.params.id]
//     );
//
//     if (!rows.length) throw new AppError('Заказ не найден', 404);
//     res.json({ success: true, data: rows[0] });
// }));
//
// // ═══════════════════════════════════════
// // ADMIN — управление заказами
// // ═══════════════════════════════════════
//
// // GET /api/admin/orders
// router.get('/admin/list', authMiddleware, asyncHandler(async (req, res) => {
//     const { status, type, date_from, date_to, page = 1, limit = 20 } = req.query;
//     const offset = (parseInt(page) - 1) * parseInt(limit);
//     const params = [];
//     const conditions = [];
//
//     if (status) {
//         params.push(status);
//         conditions.push(`o.status = $${params.length}`);
//     }
//     if (type) {
//         params.push(type);
//         conditions.push(`o.type = $${params.length}`);
//     }
//     if (date_from) {
//         params.push(date_from);
//         conditions.push(`o.created_at >= $${params.length}`);
//     }
//     if (date_to) {
//         params.push(date_to);
//         conditions.push(`o.created_at <= $${params.length}`);
//     }
//
//     const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
//
//     // Подсчёт
//     const { rows: [{ count }] } = await pool.query(
//         `SELECT COUNT(*) FROM orders o ${where}`, params
//     );
//
//     // Данные
//     params.push(parseInt(limit), offset);
//     const { rows } = await pool.query(
//         `SELECT o.*,
//             COALESCE(json_agg(
//                 json_build_object('item_name', oi.item_name, 'quantity', oi.quantity, 'price', oi.price_at_order)
//             ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
//          FROM orders o
//          LEFT JOIN order_items oi ON oi.order_id = o.id
//          ${where}
//          GROUP BY o.id
//          ORDER BY o.created_at DESC
//          LIMIT $${params.length - 1} OFFSET $${params.length}`,
//         params
//     );
//
//     res.json({
//         success: true,
//         data: rows,
//         pagination: {
//             total: parseInt(count),
//             page: parseInt(page),
//             limit: parseInt(limit),
//             totalPages: Math.ceil(parseInt(count) / parseInt(limit)),
//         },
//     });
// }));
//
// // GET /api/admin/orders/:id
// router.get('/admin/:id', authMiddleware, asyncHandler(async (req, res) => {
//     const { rows } = await pool.query(
//         `SELECT o.*,
//             COALESCE(json_agg(
//                 json_build_object('id', oi.id, 'item_id', oi.item_id, 'item_name', oi.item_name,
//                     'quantity', oi.quantity, 'price', oi.price_at_order)
//                 ORDER BY oi.id
//             ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items,
//             off.name as office_name, off.address as office_address
//          FROM orders o
//          LEFT JOIN order_items oi ON oi.order_id = o.id
//          LEFT JOIN offices off ON off.id = o.office_id
//          WHERE o.id = $1
//          GROUP BY o.id, off.name, off.address`,
//         [req.params.id]
//     );
//
//     if (!rows.length) throw new AppError('Заказ не найден', 404);
//
//     // История статусов
//     const { rows: history } = await pool.query(
//         'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY changed_at',
//         [req.params.id]
//     );
//
//     res.json({ success: true, data: { ...rows[0], status_history: history } });
// }));
//
// // PATCH /api/admin/orders/:id/status — смена статуса
// router.patch('/admin/:id/status', authMiddleware, asyncHandler(async (req, res) => {
//     const { status } = req.body;
//     const validStatuses = ['paid', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'];
//
//     if (!validStatuses.includes(status)) {
//         throw new AppError(`Невалидный статус. Допустимые: ${validStatuses.join(', ')}`, 400);
//     }
//
//     const { rows: [order] } = await pool.query(
//         'SELECT * FROM orders WHERE id = $1',
//         [req.params.id]
//     );
//     if (!order) throw new AppError('Заказ не найден', 404);
//
//     // Обновляем
//     await pool.query(
//         'UPDATE orders SET status = $1 WHERE id = $2',
//         [status, req.params.id]
//     );
//
//     // История
//     await pool.query(
//         `INSERT INTO order_status_history (order_id, status, changed_by)
//          VALUES ($1, $2, $3)`,
//         [req.params.id, status, req.admin.username]
//     );
//
//     // Telegram уведомление клиенту
//     sendOrderNotification(order.telegram_user_id, order.id, status).catch(console.error);
//
//     res.json({ success: true, message: `Статус изменён на ${status}` });
// }));
//
// module.exports = router;
