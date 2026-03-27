const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const { initBot } = require('./modules/telegram/service');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();

// ═══ Глобальные middleware ═══
app.use(helmet());
app.use(cors({
    origin: true,  // разрешить все origins (для тестирования через ngrok)
    credentials: true,
}));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 100,
    message: { success: false, message: 'Слишком много запросов, попробуйте позже' },
});
app.use('/api/', apiLimiter);

// Статика (загруженные изображения)
app.use('/uploads', express.static(path.resolve(config.upload.dir)));
// ═══ PUBLIC роуты (Mini App) ═══
app.use('/api/categories', require('./modules/categories/routes'));
app.use('/api/items', require('./modules/items/routes'));
app.use('/api/offices', require('./modules/offices/routes'));
app.use('/api/promo', require('./modules/promos/routes'));
app.use('/api/orders', require('./modules/orders/public.routes'));
app.use('/api/users', require('./modules/users/routes'));
app.use('/api/settings', require('./modules/settings/routes'));
app.use('/api/favorites', require('./modules/favorites/routes'));
app.use('/api/reviews', require('./modules/reviews/routes'));
app.use('/api/branches', require('./modules/branches/routes'));

// ═══ WEBHOOK (Finik) ═══
app.use('/api/webhooks', require('./modules/payments/routes'));

// ═══ ADMIN роуты ═══
app.use('/api/admin/auth', require('./modules/auth/routes'));
app.use('/api/admin/categories', require('./modules/categories/admin.routes'));
app.use('/api/admin/items', require('./modules/items/admin.routes'));
app.use('/api/admin/offices', require('./modules/offices/admin.routes'));
app.use('/api/admin/promos', require('./modules/promos/admin.routes'));
app.use('/api/admin/orders', require('./modules/orders/admin.routes'));
app.use('/api/admin/users', require('./modules/users/admin.routes'));
app.use('/api/admin/stats', require('./modules/stats/routes'));
app.use('/api/admin/settings', require('./modules/settings/routes'));
app.use('/api/admin/branches', require('./modules/branches/routes'));

// ═══ PRINT роуты (admin) ═══
app.use('/api/admin', require('./modules/print/routes'));

// ═══ API Documentation (Swagger UI) ═══
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Food Delivery API Docs',
}));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// ═══ Health check ═══
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══ Mini App — статика (собранный React build) ═══
const miniappDist = path.resolve(__dirname, '../../miniapp/dist');
const adminDist = path.resolve(__dirname, '../../admin/dist');
const fs = require('fs');

// Admin panel: /admin/*
if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist));
    app.get('/admin/*', (req, res) => {
        res.sendFile(path.join(adminDist, 'index.html'));
    });
}

// Mini App: всё остальное (SPA fallback)
if (fs.existsSync(miniappDist)) {
    app.use(express.static(miniappDist));
    app.get('*', (req, res, next) => {
        // Не перехватываем /api/* роуты
        if (req.url.startsWith('/api/')) return next();
        res.sendFile(path.join(miniappDist, 'index.html'));
    });
}

// ═══ 404 (только для /api/* которые не нашлись) ═══
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Маршрут ${req.method} ${req.url} не найден` });
});

// ═══ Глобальный error handler ═══
app.use(errorHandler);

// ═══ Запуск ═══
const start = async () => {
    try {
        // Проверка подключения к БД
        const pool = require('./db/pool');
        await pool.query('SELECT 1');
        console.log('✅ PostgreSQL connected');

        // Запуск Telegram бота
        initBot();

        // Запуск сервера
        app.listen(config.port, () => {
            console.log(`🚀 Server running on port ${config.port} (${config.nodeEnv})`);
            console.log(`📡 API: http://localhost:${config.port}/api`);
            console.log(`📖 Docs: http://localhost:${config.port}/api/docs`);
        });
    } catch (err) {
        console.error('❌ Failed to start:', err.message);
        process.exit(1);
    }
};

start();

module.exports = app;