const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

// ─── PUBLIC: список филиалов для Mini App ───
router.get('/public', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        'SELECT id, name, address, phone, lat, lng FROM branches WHERE is_open = true ORDER BY sort_order'
    );
    res.json({ success: true, data: rows });
}));

// ─── PUBLIC: настройки конкретного филиала ───
router.get('/public/:id', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM branches WHERE id = $1', [req.params.id]);
    if (!rows.length) throw new AppError('Филиал не найден', 404);

    const branch = rows[0];
    const now = new Date();
    const bishkekOffset = 6;
    const localHours = (now.getUTCHours() + bishkekOffset) % 24;
    const current = `${String(localHours).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

    let isCurrentlyOpen = false;
    if (!branch.is_open) {
        isCurrentlyOpen = false;
    } else if (branch.is_24h) {
        isCurrentlyOpen = true;
    } else {
        isCurrentlyOpen = current >= branch.working_hours_from && current <= branch.working_hours_to;
    }

    // Утренний режим: 07:00-10:00
    const isMorningMode = branch.morning_mode_enabled && current >= '07:00' && current < '10:00';

    // Офисные адреса если утренний режим
    let officeAddresses = [];
    if (isMorningMode) {
        const { rows: offices } = await pool.query(
            'SELECT * FROM office_addresses WHERE branch_id = $1 AND is_active = true ORDER BY sort_order',
            [branch.id]
        );
        officeAddresses = offices;
    }

    res.json({
        success: true,
        data: {
            ...branch,
            is_currently_open: isCurrentlyOpen,
            is_morning_mode: isMorningMode,
            morning_delivery_fee: isMorningMode ? 0 : branch.delivery_fee,
            office_addresses: officeAddresses,
        },
    });
}));

// ─── ADMIN ───
router.use(authMiddleware);

// GET /api/admin/branches
router.get('/', asyncHandler(async (req, res) => {
    const isSuperadmin = req.admin.role === 'superadmin';
    let query = 'SELECT * FROM branches';
    const params = [];

    if (!isSuperadmin && req.admin.branch_id) {
        params.push(req.admin.branch_id);
        query += ' WHERE id = $1';
    }
    query += ' ORDER BY sort_order';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
}));

// POST /api/admin/branches (superadmin only)
router.post('/', asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin') throw new AppError('Только суперадмин', 403);

    const { name, address, phone, lat, lng, working_hours_from, working_hours_to, is_24h,
        is_open, delivery_fee, min_order_amount, morning_mode_enabled, sort_order } = req.body;
    if (!name || !address) throw new AppError('name и address обязательны', 400);

    const { rows } = await pool.query(
        `INSERT INTO branches (name, address, phone, lat, lng, working_hours_from, working_hours_to,
            is_24h, is_open, delivery_fee, min_order_amount, morning_mode_enabled, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [name, address, phone || null, lat || null, lng || null,
            working_hours_from || '10:00', working_hours_to || '23:00',
            is_24h ?? false, is_open ?? true, delivery_fee ?? 150,
            min_order_amount ?? 0, morning_mode_enabled ?? false, sort_order ?? 0]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

// PUT /api/admin/branches/:id
router.put('/:id', asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin') throw new AppError('Только суперадмин', 403);

    const { name, address, phone, lat, lng, working_hours_from, working_hours_to, is_24h,
        is_open, delivery_fee, min_order_amount, morning_mode_enabled, sort_order } = req.body;

    const { rows } = await pool.query(
        `UPDATE branches SET name=$1, address=$2, phone=$3, lat=$4, lng=$5,
            working_hours_from=$6, working_hours_to=$7, is_24h=$8, is_open=$9,
            delivery_fee=$10, min_order_amount=$11, morning_mode_enabled=$12, sort_order=$13
         WHERE id=$14 RETURNING *`,
        [name, address, phone, lat, lng, working_hours_from, working_hours_to,
            is_24h, is_open, delivery_fee, min_order_amount, morning_mode_enabled, sort_order, req.params.id]
    );
    if (!rows.length) throw new AppError('Филиал не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

// DELETE /api/admin/branches/:id
router.delete('/:id', asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin') throw new AppError('Только суперадмин', 403);
    const { rowCount } = await pool.query('DELETE FROM branches WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Филиал не найден', 404);
    res.json({ success: true, message: 'Удалено' });
}));

// ─── Офисные адреса ───
router.get('/:branchId/offices', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM office_addresses WHERE branch_id = $1 ORDER BY sort_order',
        [req.params.branchId]
    );
    res.json({ success: true, data: rows });
}));

router.post('/:branchId/offices', asyncHandler(async (req, res) => {
    const { name, address, sort_order } = req.body;
    if (!name || !address) throw new AppError('name и address обязательны', 400);

    const { rows } = await pool.query(
        `INSERT INTO office_addresses (branch_id, name, address, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.params.branchId, name, address, sort_order || 0]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

router.delete('/offices/:id', asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM office_addresses WHERE id = $1', [req.params.id]);
    if (!rowCount) throw new AppError('Не найдено', 404);
    res.json({ success: true, message: 'Удалено' });
}));

// ─── Привязка категорий к филиалу ───
router.get('/:branchId/categories', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT c.*, CASE WHEN cb.id IS NOT NULL THEN true ELSE false END as is_linked
        FROM categories c
        LEFT JOIN category_branches cb ON cb.category_id = c.id AND cb.branch_id = $1
        ORDER BY c.sort_order
    `, [req.params.branchId]);
    res.json({ success: true, data: rows });
}));

router.post('/:branchId/categories', asyncHandler(async (req, res) => {
    const { category_ids } = req.body; // массив ID категорий
    if (!Array.isArray(category_ids)) throw new AppError('category_ids должен быть массивом', 400);

    // Удаляем старые привязки
    await pool.query('DELETE FROM category_branches WHERE branch_id = $1', [req.params.branchId]);

    // Вставляем новые
    for (const catId of category_ids) {
        await pool.query(
            'INSERT INTO category_branches (category_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [catId, req.params.branchId]
        );
    }

    res.json({ success: true, message: `Привязано ${category_ids.length} категорий` });
}));

module.exports = router;