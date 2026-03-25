const TelegramBot = require('node-telegram-bot-api');
const config = require('../../config');

let bot = null;

const STATUS_MESSAGES = {
    paid: '✅ Заказ #{id} оплачен! Готовим вашу еду 👨‍🍳',
    preparing: '👨‍🍳 Заказ #{id} готовится!',
    ready: '📦 Заказ #{id} готов!',
    delivering: '🚚 Заказ #{id} — курьер в пути!',
    delivered: '🍽 Заказ #{id} доставлен! Приятного аппетита!',
    cancelled: '❌ Заказ #{id} отменён.',
};

const initBot = () => {
    if (!config.telegram.botToken) {
        console.warn('TELEGRAM_BOT_TOKEN не задан — бот не запущен');
        return;
    }

    bot = new TelegramBot(config.telegram.botToken, { polling: true });

    // /start
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const name = msg.from.first_name || 'Гость';

        const text = [
            `👋 Привет, ${name}!`,
            '',
            `🍽 *${config.restaurant.name}*`,
            '',
            'Доставка еды по Бишкеку. Суши, стейки, бургеры и многое другое!',
            '',
            '⏰ 10:00 — 23:00 ежедневно',
            '📦 Минимальный заказ: 300 сом',
            '🚚 Доставка: 30-50 минут',
        ].join('\n');

        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🍽 Заказать еду', web_app: { url: config.telegram.miniAppUrl } }],
                    [
                        { text: '📞 Связаться', url: `https://wa.me/${config.restaurant.phone.replace(/[^0-9]/g, '')}` },
                        { text: '📍 Адрес', url: 'https://go.2gis.com/yourlink' },
                    ],
                ],
            },
            parse_mode: 'Markdown',
        };

        // Отправляем баннер (если есть) + текст
        try {
            await bot.sendMessage(chatId, text, keyboard);
        } catch (err) {
            console.error('Telegram /start error:', err.message);
        }
    });

    // /help
    bot.onText(/\/help/, (msg) => {
        bot.sendMessage(msg.chat.id,
            '🍽 Нажмите кнопку «Заказать еду» чтобы открыть меню.\n' +
            '📦 После оплаты вы получите уведомление о статусе заказа.\n' +
            '❓ По вопросам пишите менеджеру.',
        );
    });

    console.log('Telegram bot started');
};

/**
 * Отправка уведомления о статусе заказа
 */
const sendOrderNotification = async (telegramUserId, orderId, status) => {
    if (!bot || !telegramUserId) return;

    const template = STATUS_MESSAGES[status];
    if (!template) return;

    const text = template.replace('{id}', orderId);

    try {
        await bot.sendMessage(telegramUserId, text);
    } catch (err) {
        console.error(`Telegram notification failed for user ${telegramUserId}:`, err.message);
    }
};

/**
 * Отправка PDF чека пользователю
 */
const sendReceiptPDF = async (telegramUserId, pdfBuffer, orderId) => {
    if (!bot || !telegramUserId) return;

    try {
        await bot.sendDocument(telegramUserId, pdfBuffer, {
            caption: `📄 Чек по заказу #${orderId}`,
        }, { filename: `receipt-${orderId}.pdf`, contentType: 'application/pdf' });
    } catch (err) {
        console.error(`Telegram PDF send failed for user ${telegramUserId}:`, err.message);
    }
};

module.exports = { initBot, sendOrderNotification, sendReceiptPDF };
