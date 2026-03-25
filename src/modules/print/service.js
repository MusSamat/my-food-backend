const pool = require('../../db/pool');
const config = require('../../config');

// ═══════════════════════════════════════
// Загрузка данных заказа для чека
// ═══════════════════════════════════════

const getOrderForReceipt = async (orderId) => {
    const { rows: [order] } = await pool.query(
        `SELECT o.*,
            off.name as office_name, off.address as office_address
         FROM orders o
         LEFT JOIN offices off ON off.id = o.office_id
         WHERE o.id = $1`,
        [orderId]
    );
    if (!order) return null;

    const { rows: items } = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id',
        [orderId]
    );
    order.items = items;
    return order;
};

// ═══════════════════════════════════════
// HTML шаблоны
// ═══════════════════════════════════════

const formatDate = (d) => {
    const dt = new Date(d);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}, ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const formatPrice = (n) => n.toLocaleString('ru-RU');

const generateKitchenHTML = (order) => {
    const itemsHtml = order.items.map(i =>
        `<tr><td style="text-align:left;padding:4px 0;font-size:16px;">
            <strong>${i.quantity}×</strong> ${i.item_name}
        </td></tr>`
    ).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; width: 80mm; padding: 8mm 4mm; }
    .center { text-align: center; }
    .title { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .order-num { font-size: 28px; font-weight: bold; margin: 8px 0; }
    .type { font-size: 16px; font-weight: bold; margin-bottom: 6px; }
    .date { font-size: 12px; color: #666; margin-bottom: 8px; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    .comment { font-style: italic; font-size: 13px; padding: 6px 0; }
    .footer { font-size: 10px; color: #999; margin-top: 8px; }
    @media print { body { width: 80mm; margin: 0; } }
</style></head><body>
    <div class="center title">КУХНЯ</div>
    <div class="center order-num">Заказ #${order.id}</div>
    <div class="center type">${order.type === 'delivery' ? 'Доставка' : 'Самовывоз'
        }${order.office_name ? ` (${order.office_name})` : ''}</div>
    <div class="center date">${formatDate(order.created_at)}</div>
    <div class="divider"></div>
    <table>${itemsHtml}</table>
    ${order.comment ? `<div class="divider"></div><div class="comment">Комментарий: ${order.comment}</div>` : ''}
    <div class="divider"></div>
    <div style="font-size:13px;">Приборы: ${order.cutlery_count || 1}</div>
    <div class="divider"></div>
    <div class="center footer">Напечатано: ${formatDate(new Date())}</div>
</body></html>`;
};

const generateClientHTML = (order) => {
    const itemsHtml = order.items.map(i => {
        const sum = i.quantity * i.price_at_order;
        return `<tr>
            <td style="text-align:left;padding:3px 0;">${i.item_name}</td>
            <td style="text-align:center;padding:3px 4px;">${i.quantity}</td>
            <td style="text-align:right;padding:3px 4px;">${formatPrice(i.price_at_order)}</td>
            <td style="text-align:right;padding:3px 0;">${formatPrice(sum)}</td>
        </tr>`;
    }).join('');

    const addressBlock = order.type === 'delivery'
        ? `<div style="font-size:12px;padding:2px 0;">Адрес: ${[order.address, order.apartment && `кв. ${order.apartment}`,
            order.floor && `${order.floor} этаж`, order.entrance && `подъезд ${order.entrance}`].filter(Boolean).join(', ')}</div>`
        : order.office_name
            ? `<div style="font-size:12px;padding:2px 0;">Самовывоз: ${order.office_name}, ${order.office_address || ''}</div>`
            : '';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; width: 80mm; padding: 8mm 4mm; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .muted { color: #666; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .divider-solid { border-top: 2px solid #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 3px 0; font-size: 11px; border-bottom: 1px solid #ccc; }
    @media print { body { width: 80mm; margin: 0; } }
</style></head><body>
    <div class="center bold" style="font-size:16px;">${config.restaurant.name}</div>
    <div class="center muted" style="font-size:10px;">${config.restaurant.address}</div>
    <div class="center muted" style="font-size:10px;">${config.restaurant.phone}</div>
    <div class="divider-solid"></div>

    <div class="bold" style="font-size:14px;">Заказ #${order.id}</div>
    <div style="font-size:12px;">${formatDate(order.created_at)}</div>
    <div class="bold" style="font-size:12px;">${order.type === 'delivery' ? 'Доставка' : 'Самовывоз'}</div>
    <div class="divider"></div>

    <table>
        <tr><th>Наименование</th><th style="text-align:center;">Кол</th><th style="text-align:right;">Цена</th><th style="text-align:right;">Сумма</th></tr>
        ${itemsHtml}
    </table>
    <div class="divider"></div>

    <div class="right" style="font-size:12px;">Сумма: ${formatPrice(order.subtotal)} сом</div>
    ${order.discount > 0 ? `<div class="right" style="font-size:12px;">Скидка${order.promo_code ? ` (${order.promo_code})` : ''}: -${formatPrice(order.discount)} сом</div>` : ''}
    ${order.type === 'delivery' ? `<div class="right" style="font-size:12px;">Доставка: ${order.delivery_fee > 0 ? formatPrice(order.delivery_fee) + ' сом' : 'бесплатно'}</div>` : ''}
    <div class="divider-solid"></div>
    <div class="right bold" style="font-size:18px;">ИТОГО: ${formatPrice(order.total)} сом</div>
    <div class="divider"></div>

    <div style="font-size:12px;">Оплата: Finik Pay</div>
    <div style="font-size:12px;">Статус: ${order.payment_status === 'success' ? 'Оплачено' : 'Ожидание'}</div>
    <div class="divider"></div>

    <div style="font-size:12px;">Клиент: ${order.name}</div>
    <div style="font-size:12px;">Телефон: ${order.phone}</div>
    ${addressBlock}
    ${order.comment ? `<div style="font-size:12px;font-style:italic;">Комментарий: ${order.comment}</div>` : ''}
    <div style="font-size:12px;">Приборы: ${order.cutlery_count || 1}</div>
    <div class="divider-solid"></div>

    <div class="center bold" style="font-size:12px;">Спасибо за заказ!</div>
    <div class="center muted" style="font-size:10px;margin-top:4px;">Напечатано: ${formatDate(new Date())}</div>
</body></html>`;
};

// ═══════════════════════════════════════
// ESC/POS для термопринтера
// ═══════════════════════════════════════

const generateKitchenESCPOS = (order) => {
    const lines = [];
    const ESC = '\x1b';
    const GS = '\x1d';

    // Инициализация + центрирование
    lines.push(`${ESC}@`); // init
    lines.push(`${ESC}a\x01`); // center

    // КУХНЯ — крупно
    lines.push(`${GS}!\x11`); // double width+height
    lines.push('КУХНЯ\n');
    lines.push(`${GS}!\x00`); // normal

    // Номер заказа — очень крупно
    lines.push(`${GS}!\x11`);
    lines.push(`Заказ #${order.id}\n`);
    lines.push(`${GS}!\x00`);

    // Тип заказа
    lines.push(`${ESC}E\x01`); // bold on
    lines.push(`${order.type === 'delivery' ? 'Доставка' : 'Самовывоз'}\n`);
    lines.push(`${ESC}E\x00`); // bold off

    // Дата
    lines.push(`${formatDate(order.created_at)}\n`);

    // Разделитель
    lines.push(`${ESC}a\x00`); // left align
    lines.push('--------------------------------\n');

    // Позиции
    for (const item of order.items) {
        lines.push(`${ESC}E\x01`);
        lines.push(`${item.quantity}x `);
        lines.push(`${ESC}E\x00`);
        lines.push(`${item.item_name}\n`);
    }

    // Комментарий
    if (order.comment) {
        lines.push('--------------------------------\n');
        lines.push(`Комм: ${order.comment}\n`);
    }

    lines.push('--------------------------------\n');
    lines.push(`Приборы: ${order.cutlery_count || 1}\n`);
    lines.push('--------------------------------\n');

    // Время печати
    lines.push(`${ESC}a\x01`); // center
    lines.push(`${formatDate(new Date())}\n`);

    // Обрезка бумаги
    lines.push('\n\n\n');
    lines.push(`${GS}V\x00`); // cut

    return Buffer.from(lines.join(''), 'binary');
};

// ═══════════════════════════════════════
// Отправка на термопринтер (LAN)
// ═══════════════════════════════════════

const printToThermal = async (buffer) => {
    const { rows: [settings] } = await pool.query('SELECT * FROM printer_settings LIMIT 1');

    if (!settings || settings.connection_type === 'browser') {
        return { printed: false, reason: 'Термопринтер не настроен' };
    }

    const net = require('net');

    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.setTimeout(5000);

        client.connect(settings.port || 9100, settings.ip_address, () => {
            client.write(buffer, () => {
                client.destroy();
                resolve({ printed: true });
            });
        });

        client.on('error', (err) => {
            client.destroy();
            reject(new Error(`Принтер недоступен: ${err.message}`));
        });

        client.on('timeout', () => {
            client.destroy();
            reject(new Error('Таймаут подключения к принтеру'));
        });
    });
};

// ═══════════════════════════════════════
// PDF через puppeteer
// ═══════════════════════════════════════

const generatePDF = async (html) => {
    let puppeteer;
    try {
        puppeteer = require('puppeteer');
    } catch {
        throw new Error('puppeteer не установлен. Выполните: npm install puppeteer');
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({
            width: '80mm',
            height: '297mm',
            printBackground: true,
            margin: { top: '2mm', right: '2mm', bottom: '2mm', left: '2mm' },
        });
        return pdf;
    } finally {
        await browser.close();
    }
};

// ═══════════════════════════════════════
// Автопечать при оплате
// ═══════════════════════════════════════

const autoPrintIfEnabled = async (orderId) => {
    try {
        const { rows: [settings] } = await pool.query('SELECT * FROM printer_settings LIMIT 1');
        if (!settings || settings.connection_type === 'browser') return;

        const order = await getOrderForReceipt(orderId);
        if (!order) return;

        if (settings.auto_print_kitchen) {
            const buffer = generateKitchenESCPOS(order);
            await printToThermal(buffer).catch(err =>
                console.error(`Auto-print kitchen failed for order #${orderId}:`, err.message)
            );
        }

        if (settings.auto_print_client) {
            // Клиентский чек тоже через ESC/POS (упрощённый)
            // В реальности можно генерировать отдельный ESC/POS для клиентского
            const buffer = generateKitchenESCPOS(order); // TODO: отдельный generateClientESCPOS
            await printToThermal(buffer).catch(err =>
                console.error(`Auto-print client failed for order #${orderId}:`, err.message)
            );
        }
    } catch (err) {
        console.error(`Auto-print error for order #${orderId}:`, err.message);
    }
};

module.exports = {
    getOrderForReceipt,
    generateKitchenHTML,
    generateClientHTML,
    generateKitchenESCPOS,
    printToThermal,
    generatePDF,
    autoPrintIfEnabled,
};
