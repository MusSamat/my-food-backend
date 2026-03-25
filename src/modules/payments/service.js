const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config');

const finikClient = axios.create({
    baseURL: config.finik.apiUrl,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

/**
 * Создание платежа в Finik Pay
 * @param {object} params
 * @param {number} params.amount - сумма в сомах
 * @param {string} params.orderId - ID заказа
 * @param {string} params.description - описание платежа
 * @returns {{ paymentId: string, paymentUrl: string }}
 */
const createPayment = async ({ amount, orderId, description }) => {
    const payload = {
        amount: amount * 100, // Finik принимает в тийынах (x100)
        order_id: String(orderId),
        description: description || `Заказ #${orderId}`,
        callback_url: config.finik.callbackUrl,
        redirect_url: `${config.finik.redirectUrl}/${orderId}`,
        api_key: config.finik.apiKey,
    };

    try {
        const { data } = await finikClient.post('/payments/create', payload);

        return {
            paymentId: data.payment_id || data.id,
            paymentUrl: data.payment_url || data.url,
        };
    } catch (err) {
        console.error('Finik create payment error:', err.response?.data || err.message);
        throw new Error('Ошибка создания платежа: ' + (err.response?.data?.message || err.message));
    }
};

/**
 * Проверка подписи webhook от Finik
 * Finik отправляет signature в headers или body
 */
const verifyWebhookSignature = (payload, signature) => {
    const calculated = crypto
        .createHmac('sha256', config.finik.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(calculated, 'hex'),
        Buffer.from(signature, 'hex')
    );
};

/**
 * Проверка статуса платежа через API (для fallback)
 */
const checkPaymentStatus = async (paymentId) => {
    try {
        const { data } = await finikClient.get(`/payments/${paymentId}/status`, {
            params: { api_key: config.finik.apiKey },
        });
        return data;
    } catch (err) {
        console.error('Finik check status error:', err.response?.data || err.message);
        return null;
    }
};

module.exports = { createPayment, verifyWebhookSignature, checkPaymentStatus };
