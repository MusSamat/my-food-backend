// Async wrapper — catch errors in async route handlers
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// App error class
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

// Global error handler
const errorHandler = (err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const message = err.isOperational ? err.message : 'Внутренняя ошибка сервера';

    if (!err.isOperational) {
        console.error('UNHANDLED ERROR:', err);
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = { asyncHandler, AppError, errorHandler };
