/**
 * Branches - Admin Routes
 * CRUD филиалов + настройки + привязка категорий
 */

const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();
router.use(authMiddleware);

// ─── Middleware: получаем роль и branch_id из токена ───
const extractBranchContext = asyncHandler(async (req, res, next) => {
    const { rows } = await pool.query(
        'SELECT role, branch_id FROM users WHERE id = $1',
        [req.admin.id]
    );

    if (!rows.length) throw new AppError('Пользователь не найден', 401);

    req.userRole = rows[0].role;
    req.userBranchId = rows[0].branch_id;
    req.isSuperadmin = rows[0].role === 'superadmin';

    next();
});

router.use(extractBranchContext);

// ─── Middleware: только superadmin ───
const requireSuperadmin = (req, res, next) => {
    if (!req.isSuperadmin) {
        throw new AppError('Требуются права superadmin', 403);
    }
    next();
};

// ═══════════════════════════════════════════════════════════
// BRANCHES CRUD
// ═══════════════════════════════════════════════════════════

// GET /api/admin/branches - список филиалов
router.get('/', asyncHandler(async (req, res) => {
    let query = 'SELECT * FROM branches';
    const params = [];

    // Operator видит только свой филиал
    if (!req.isSuperadmin) {
        if (!req.userBranchId) {
            return res.json({ success: true, data: [] });
        }
        query += ' WHERE id = $1';
        params.push(req.userBranchId);
    }

    query += ' ORDER BY id';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
}));

// GET /api/admin/branches/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const branchId = parseInt(req.params.id);

    // Operator может смотреть только свой филиал
    if (!req.isSuperadmin && req.userBranchId !== branchId) {
        throw new AppError('Нет доступа к этому филиалу', 403);
    }

    const { rows } = await pool.query('SELECT * FROM branches WHERE id = $1', [branchId]);
    if (!rows.length) throw new AppError('Филиал не найден', 404);

    res.json({ success: true, data: rows[0] });
}));

// POST /api/admin/branches - создать филиал (superadmin)
router.post('/', requireSuperadmin, asyncHandler(async (req, res) => {
    const {
        name, address, phone, lat, lng,
        is_24h, working_hours_from, working_hours_to, is_open,
        delivery_fee, min_order_amount,
        morning_mode_enabled, morning_mode_from, morning_mode_to
    } = req.body;

    if (!name) throw new AppError('Название обязательно', 400);

    const { rows } = await pool.query(`
        INSERT INTO branches (
            name, address, phone, lat, lng,
            is_24h, working_hours_from, working_hours_to, is_open,
            delivery_fee, min_order_amount,
            morning_mode_enabled, morning_mode_from, morning_mode_to
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
    `, [
        name, address || null, phone || null, lat || null, lng || null,
        is_24h ?? false, working_hours_from || '09:00', working_hours_to || '22:00', is_open ?? true,
        delivery_fee ?? 0, min_order_amount ?? 0,
        morning_mode_enabled ?? false, morning_mode_from || '07:00', morning_mode_to || '10:00'
    ]);

    res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/admin/branches/:id - обновить филиал
router.put('/:id', asyncHandler(async (req, res) => {
    const branchId = parseInt(req.params.id);

    // Operator может редактировать только свой филиал
    if (!req.isSuperadmin && req.userBranchId !== branchId) {
        throw new AppError('Нет доступа к этому филиалу', 403);
    }

    const {
        name, address, phone, lat, lng,
        is_24h, working_hours_from, working_hours_to, is_open,
        delivery_fee, min_order_amount,
        morning_mode_enabled, morning_mode_from, morning_mode_to,
        is_active
    } = req.body;

    // Operator не может менять name и is_active
    const finalName = req.isSuperadmin ? name : undefined;
    const finalIsActive = req.isSuperadmin ? is_active : undefined;

    const { rows: existing } = await pool.query('SELECT * FROM branches WHERE id = $1', [branchId]);
    if (!existing.length) throw new AppError('Филиал не найден', 404);

    const branch = existing[0];

    const { rows } = await pool.query(`
        UPDATE branches SET
            name = COALESCE($1, name),
            address = COALESCE($2, address),
            phone = COALESCE($3, phone),
            lat = COALESCE($4, lat),
            lng = COALESCE($5, lng),
            is_24h = COALESCE($6, is_24h),
            working_hours_from = COALESCE($7, working_hours_from),
            working_hours_to = COALESCE($8, working_hours_to),
            is_open = COALESCE($9, is_open),
            delivery_fee = COALESCE($10, delivery_fee),
            min_order_amount = COALESCE($11, min_order_amount),
            morning_mode_enabled = COALESCE($12, morning_mode_enabled),
            morning_mode_from = COALESCE($13, morning_mode_from),
            morning_mode_to = COALESCE($14, morning_mode_to),
            is_active = COALESCE($15, is_active),
            updated_at = NOW()
        WHERE id = $16
        RETURNING *
    `, [
        finalName, address, phone, lat, lng,
        is_24h, working_hours_from, working_hours_to, is_open,
        delivery_fee, min_order_amount,
        morning_mode_enabled, morning_mode_from, morning_mode_to,
        finalIsActive, branchId
    ]);

    res.json({ success: true, data: rows[0] });
}));

// DELETE /api/admin/branches/:id (soft delete, superadmin)
router.delete('/:id', requireSuperadmin, asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        'UPDATE branches SET is_active = false WHERE id = $1 RETURNING *',
        [req.params.id]
    );
    if (!rows.length) throw new AppError('Филиал не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

// ═══════════════════════════════════════════════════════════
// OFFICE ADDRESSES (для утреннего режима)
// ═══════════════════════════════════════════════════════════

// GET /api/admin/branches/:branchId/offices
router.get('/:branchId/offices', asyncHandler(async (req, res) => {
    const branchId = parseInt(req.params.branchId);

    if (!req.isSuperadmin && req.userBranchId !== branchId) {
        throw new AppError('Нет доступа', 403);
    }

    const { rows } = await pool.query(
        'SELECT * FROM office_addresses WHERE branch_id = $1 ORDER BY name',
        [branchId]
    );
    res.json({ success: true, data: rows });
}));

// POST /api/admin/branches/:branchId/offices
router.post('/:branchId/offices', asyncHandler(async (req, res) => {
    const branchId = parseInt(req.params.branchId);

    if (!req.isSuperadmin && req.userBranchId !== branchId) {
        throw new AppError('Нет доступа', 403);
    }

    const { name, address, lat, lng } = req.body;
    if (!name || !address) throw new AppError('name и address обязательны', 400);

    const { rows } = await pool.query(`
        INSERT INTO office_addresses (branch_id, name, address, lat, lng)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [branchId, name, address, lat || null, lng || null]);

    res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/admin/branches/offices/:id
router.put('/offices/:id', asyncHandler(async (req, res) => {
    const officeId = parseInt(req.params.id);

    // Проверяем владение
    const { rows: existing } = await pool.query(
        'SELECT * FROM office_addresses WHERE id = $1', [officeId]
    );
    if (!existing.length) throw new AppError('Офис не найден', 404);

    if (!req.isSuperadmin && req.userBranchId !== existing[0].branch_id) {
        throw new AppError('Нет доступа', 403);
    }

    const { name, address, lat, lng, is_active } = req.body;

    const { rows } = await pool.query(`
        UPDATE office_addresses SET
            name = COALESCE($1, name),
            address = COALESCE($2, address),
            lat = COALESCE($3, lat),
            lng = COALESCE($4, lng),
            is_active = COALESCE($5, is_active)
        WHERE id = $6 RETURNING *
    `, [name, address, lat, lng, is_active, officeId]);

    res.json({ success: true, data: rows[0] });
}));

// DELETE /api/admin/branches/offices/:id
router.delete('/offices/:id', asyncHandler(async (req, res) => {
    const officeId = parseInt(req.params.id);

    const { rows: existing } = await pool.query(
        'SELECT * FROM office_addresses WHERE id = $1', [officeId]
    );
    if (!existing.length) throw new AppError('Офис не найден', 404);

    if (!req.isSuperadmin && req.userBranchId !== existing[0].branch_id) {
        throw new AppError('Нет доступа', 403);
    }

    await pool.query('DELETE FROM office_addresses WHERE id = $1', [officeId]);
    res.json({ success: true, message: 'Удалено' });
}));

// ═══════════════════════════════════════════════════════════
// CATEGORY-BRANCH RELATIONS (superadmin only)
// ═══════════════════════════════════════════════════════════

// GET /api/admin/branches/categories - все категории с их филиалами
router.get('/categories/all', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT 
            c.*,
            COALESCE(
                array_agg(cb.branch_id) FILTER (WHERE cb.branch_id IS NOT NULL),
                '{}'
            ) as branch_ids
        FROM categories c
        LEFT JOIN category_branches cb ON c.id = cb.category_id
        GROUP BY c.id
        ORDER BY c.sort_order, c.id
    `);
    res.json({ success: true, data: rows });
}));

// PUT /api/admin/branches/categories/:categoryId - установить филиалы для категории
router.put('/categories/:categoryId', requireSuperadmin, asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const { branch_ids } = req.body;

    if (!Array.isArray(branch_ids)) {
        throw new AppError('branch_ids должен быть массивом', 400);
    }

    // Удаляем старые связи
    await pool.query('DELETE FROM category_branches WHERE category_id = $1', [categoryId]);

    // Добавляем новые
    if (branch_ids.length > 0) {
        const values = branch_ids.map((bid, i) => `($1, $${i + 2})`).join(',');
        await pool.query(
            `INSERT INTO category_branches (category_id, branch_id) VALUES ${values}`,
            [categoryId, ...branch_ids]
        );
    }

    res.json({ success: true, data: { category_id: categoryId, branch_ids } });
}));

module.exports = router;