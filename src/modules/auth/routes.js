const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db/pool');
const config = require('../../config');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

// POST /api/admin/login
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        throw new AppError('Введите логин и пароль', 400);
    }

    const { rows } = await pool.query(
        'SELECT * FROM admins WHERE username = $1 AND is_active = true',
        [username]
    );

    if (!rows.length) {
        throw new AppError('Неверный логин или пароль', 401);
    }

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);

    if (!valid) {
        throw new AppError('Неверный логин или пароль', 401);
    }

    const token = jwt.sign(
        { id: admin.id, username: admin.username, role: admin.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );

    res.json({
        success: true,
        data: {
            token,
            admin: { id: admin.id, username: admin.username, name: admin.name, role: admin.role },
        },
    });
}));

// GET /api/admin/me
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        'SELECT id, username, name, role FROM admins WHERE id = $1',
        [req.admin.id]
    );
    res.json({ success: true, data: rows[0] });
}));

module.exports = router;
