const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');
const {
    getOrderForReceipt,
    generateKitchenHTML,
    generateClientHTML,
    generateKitchenESCPOS,
    printToThermal,
    generatePDF,
} = require('./service');

const router = Router();

// ─── Auth через query param ИЛИ header (для открытия чеков в новой вкладке) ───
const flexAuth = (req, res, next) => {
    if (req.query.token && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${req.query.token}`;
    }
    return authMiddleware(req, res, next);
};

// ─── Кухонный чек (HTML) ───
router.get('/orders/:id/receipt/kitchen', flexAuth, asyncHandler(async (req, res) => {
    const order = await getOrderForReceipt(req.params.id);
    if (!order) throw new AppError('Заказ не найден', 404);

    const html = generateKitchenHTML(order);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
}));

// ─── Клиентский чек (HTML) ───
router.get('/orders/:id/receipt/client', flexAuth, asyncHandler(async (req, res) => {
    const order = await getOrderForReceipt(req.params.id);
    if (!order) throw new AppError('Заказ не найден', 404);

    const html = generateClientHTML(order);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
}));

// ─── Клиентский чек (PDF) ───
router.get('/orders/:id/receipt/pdf', flexAuth, asyncHandler(async (req, res) => {
    const order = await getOrderForReceipt(req.params.id);
    if (!order) throw new AppError('Заказ не найден', 404);

    const html = generateClientHTML(order);
    const pdfBuffer = await generatePDF(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${order.id}.pdf"`);
    res.send(pdfBuffer);
}));

// ─── Печать кухонного чека на термопринтер ───
router.post('/orders/:id/print/kitchen', authMiddleware, asyncHandler(async (req, res) => {
    const order = await getOrderForReceipt(req.params.id);
    if (!order) throw new AppError('Заказ не найден', 404);

    const buffer = generateKitchenESCPOS(order);

    try {
        const result = await printToThermal(buffer);
        res.json({ success: true, message: 'Кухонный чек отправлен на принтер', ...result });
    } catch (err) {
        throw new AppError(err.message, 500);
    }
}));

// ─── Печать клиентского чека на термопринтер ───
router.post('/orders/:id/print/client', authMiddleware, asyncHandler(async (req, res) => {
    const order = await getOrderForReceipt(req.params.id);
    if (!order) throw new AppError('Заказ не найден', 404);

    const buffer = generateKitchenESCPOS(order);

    try {
        const result = await printToThermal(buffer);
        res.json({ success: true, message: 'Клиентский чек отправлен на принтер', ...result });
    } catch (err) {
        throw new AppError(err.message, 500);
    }
}));

// ─── Тестовая печать ───
router.post('/printer/test', authMiddleware, asyncHandler(async (req, res) => {
    const ESC = '\x1b';
    const GS = '\x1d';
    const testData = [
        `${ESC}@`,
        `${ESC}a\x01`,
        `${GS}!\x11`,
        'ТЕСТ ПРИНТЕРА\n',
        `${GS}!\x00`,
        `Дата: ${new Date().toLocaleString('ru-RU')}\n`,
        'Принтер работает!\n',
        '\n\n\n',
        `${GS}V\x00`,
    ].join('');

    try {
        const result = await printToThermal(Buffer.from(testData, 'binary'));
        res.json({ success: true, message: 'Тестовый чек отправлен', ...result });
    } catch (err) {
        throw new AppError(err.message, 500);
    }
}));

// ─── Настройки принтера ───
router.get('/settings/printer', authMiddleware, asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM printer_settings LIMIT 1');
    res.json({ success: true, data: rows[0] || null });
}));

router.put('/settings/printer', authMiddleware, asyncHandler(async (req, res) => {
    const { connection_type, ip_address, port, paper_width, auto_print_kitchen, auto_print_client } = req.body;

    const { rows: existing } = await pool.query('SELECT id FROM printer_settings LIMIT 1');

    let result;
    if (existing.length) {
        result = await pool.query(
            `UPDATE printer_settings SET
                connection_type = $1, ip_address = $2, port = $3, paper_width = $4,
                auto_print_kitchen = $5, auto_print_client = $6
             WHERE id = $7 RETURNING *`,
            [connection_type, ip_address, port || 9100, paper_width || '80mm',
                auto_print_kitchen ?? false, auto_print_client ?? false, existing[0].id]
        );
    } else {
        result = await pool.query(
            `INSERT INTO printer_settings (connection_type, ip_address, port, paper_width, auto_print_kitchen, auto_print_client)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [connection_type, ip_address, port || 9100, paper_width || '80mm',
                auto_print_kitchen ?? false, auto_print_client ?? false]
        );
    }

    res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;