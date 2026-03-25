require('dotenv').config();

module.exports = {
    port: parseInt(process.env.PORT, 10) || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',

    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        database: process.env.DB_NAME || 'food_delivery',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        miniAppUrl: process.env.MINI_APP_URL,
    },

    finik: {
        apiUrl: process.env.FINIK_API_URL || 'https://api.finik.kg',
        apiKey: process.env.FINIK_API_KEY,
        secretKey: process.env.FINIK_SECRET_KEY,
        callbackUrl: process.env.FINIK_CALLBACK_URL,
        redirectUrl: process.env.FINIK_REDIRECT_URL,
    },

    printer: {
        type: process.env.PRINTER_TYPE || 'browser',
        ip: process.env.PRINTER_IP || '192.168.1.100',
        port: parseInt(process.env.PRINTER_PORT, 10) || 9100,
    },

    upload: {
        dir: process.env.UPLOAD_DIR || './uploads',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
    },

    restaurant: {
        name: process.env.RESTAURANT_NAME || 'Restaurant',
        address: process.env.RESTAURANT_ADDRESS || '',
        phone: process.env.RESTAURANT_PHONE || '',
    },
};
