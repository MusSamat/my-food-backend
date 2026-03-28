const { Router } = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();
router.use(authMiddleware);

// Only superadmin can manage admins
const requireSuperadmin = (req, res, next) => {
    if (req.admin.role !== 'superadmin') throw new AppError('Только суперадмин', 403);
    next();
};

// GET /api/admin/admins
router.get('/', requireSuperadmin, asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT a.id, a.username, a.name, a.role, a.branch_id, a.is_active, a.created_at,
               b.name as branch_name
        FROM admins a
        LEFT JOIN branches b ON b.id = a.branch_id
        ORDER BY a.created_at
    `);
    res.json({ success: true, data: rows });
}));

// POST /api/admin/admins
router.post('/', requireSuperadmin, asyncHandler(async (req, res) => {
    const { username, password, name, role, branch_id } = req.body;
    if (!username || !password || !name) throw new AppError('username, password, name обязательны', 400);
    if (!['superadmin', 'operator'].includes(role)) throw new AppError('role: superadmin или operator', 400);
    if (role === 'operator' && !branch_id) throw new AppError('Оператору нужен филиал', 400);

    const { rows: existing } = await pool.query('SELECT id FROM admins WHERE username = $1', [username]);
    if (existing.length) throw new AppError('Логин занят', 400);

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
        `INSERT INTO admins (username, password_hash, name, role, branch_id, is_active)
         VALUES ($1,$2,$3,$4,$5,true) RETURNING id, username, name, role, branch_id, is_active`,
        [username, hash, name, role, role === 'superadmin' ? null : branch_id]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/admin/admins/:id
router.put('/:id', requireSuperadmin, asyncHandler(async (req, res) => {
    const { name, role, branch_id, is_active, password } = req.body;

    // Don't let superadmin demote themselves
    if (parseInt(req.params.id) === req.admin.id && role === 'operator') {
        throw new AppError('Нельзя понизить себя', 400);
    }

    const sets = ['name=$1', 'role=$2', 'branch_id=$3', 'is_active=$4'];
    const params = [name, role, role === 'superadmin' ? null : branch_id, is_active ?? true];

    if (password && password.trim().length >= 4) {
        const hash = await bcrypt.hash(password, 10);
        params.push(hash);
        sets.push(`password_hash=$${params.length}`);
    }

    params.push(req.params.id);
    const { rows } = await pool.query(
        `UPDATE admins SET ${sets.join(', ')} WHERE id=$${params.length}
         RETURNING id, username, name, role, branch_id, is_active`,
        params
    );
    if (!rows.length) throw new AppError('Не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

// DELETE /api/admin/admins/:id
router.delete('/:id', requireSuperadmin, asyncHandler(async (req, res) => {
    if (parseInt(req.params.id) === req.admin.id) throw new AppError('Нельзя удалить себя', 400);
    await pool.query('DELETE FROM admins WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;