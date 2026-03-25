const crypto = require('crypto');
const config = require('../config');
const { AppError } = require('./errorHandler');

// Валидация Telegram WebApp initData
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const validateTelegramData = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'];

    if (!initData) {
        throw new AppError('Отсутствует Telegram initData', 401);
    }

    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        params.delete('hash');

        // Сортировка и формирование data-check-string
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => `${key}=${val}`)
            .join('\n');

        // HMAC-SHA256
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(config.telegram.botToken)
            .digest();

        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        if (calculatedHash !== hash) {
            throw new AppError('Невалидные данные Telegram', 401);
        }

        // Извлекаем user data
        const userStr = params.get('user');
        if (userStr) {
            req.telegramUser = JSON.parse(userStr);
        }

        next();
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('Ошибка валидации Telegram данных', 401);
    }
};

module.exports = validateTelegramData;
