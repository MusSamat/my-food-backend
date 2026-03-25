const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('./errorHandler');

const authMiddleware = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        throw new AppError('Требуется авторизация', 401);
    }

    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret);
        req.admin = decoded;
        next();
    } catch {
        throw new AppError('Невалидный или истёкший токен', 401);
    }
};

module.exports = authMiddleware;
