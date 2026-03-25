const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler } = require('../../middleware/errorHandler');
const { verifyWebhookSignature } = require('./service');
const { sendOrderNotification } = require('../telegram/service');
const { autoPrintIfEnabled } = require('../print/service');

const router = Router();

// POST /api/webhooks/finik — callback от Finik о статусе платежа
router.post('/finik', asyncHandler(async (req, res) => {
    const payload = req.body;
    const signature = req.headers['x-finik-signature'] || req.body.signature;

    // ─── Верификация подписи ───
    if (signature) {
        try {
            const payloadForSign = { ...payload };
            delete payloadForSign.signature;
            const valid = verifyWebhookSignature(payloadForSign, signature);
            if (!valid) {
                console.error('Finik webhook: invalid signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }
        } catch (err) {
            console.error('Finik webhook signature verification error:', err.message);
            return res.status(403).json({ error: 'Signature verification failed' });
        }
    }

    const { payment_id, order_id, status } = payload;

    if (!payment_id || !order_id) {
        return res.status(400).json({ error: 'Missing payment_id or order_id' });
    }

    // ─── Idempotency: проверяем не обработан ли уже ───
    const { rows: [existing] } = await pool.query(
        'SELECT id, payment_status FROM orders WHERE id = $1',
        [order_id]
    );

    if (!existing) {
        console.error(`Finik webhook: order ${order_id} not found`);
        return res.status(404).json({ error: 'Order not found' });
    }

    if (existing.payment_status === 'success') {
        // Уже обработан, просто отвечаем OK
        return res.json({ success: true, message: 'Already processed' });
    }

    // ─── Обновление статуса ───
    const isSuccess = status === 'success' || status === 'paid' || status === 'completed';

    if (isSuccess) {
        await pool.query(
            `UPDATE orders SET payment_status = 'success', status = 'paid',
             payment_id = $1, paid_at = NOW() WHERE id = $2`,
            [payment_id, order_id]
        );

        await pool.query(
            `INSERT INTO order_status_history (order_id, status, changed_by)
             VALUES ($1, 'paid', 'finik_webhook')`,
            [order_id]
        );

        // Получаем полные данные заказа для уведомления и печати
        const { rows: [order] } = await pool.query(
            'SELECT * FROM orders WHERE id = $1',
            [order_id]
        );

        // Telegram уведомление
        sendOrderNotification(order.telegram_user_id, order.id, 'paid').catch(console.error);

        // Автопечать чеков (если включено в настройках)
        autoPrintIfEnabled(order.id).catch(console.error);

    } else {
        await pool.query(
            `UPDATE orders SET payment_status = 'failed', payment_id = $1 WHERE id = $2`,
            [payment_id, order_id]
        );
    }

    // Finik ожидает 200 OK
    res.json({ success: true });
}));

module.exports = router;
