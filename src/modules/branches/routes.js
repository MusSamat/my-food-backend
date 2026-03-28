const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

const BISHKEK_OFFSET = 6;
const getBishkekTime = () => {
    const now = new Date();
    const h = (now.getUTCHours() + BISHKEK_OFFSET) % 24;
    return `${String(h).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
};

// ─── PUBLIC ───

router.get('/public', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, address, phone, lat, lng, working_hours_from, working_hours_to, is_open FROM branches ORDER BY sort_order');
    res.json({ success: true, data: rows });
}));

router.get('/public/:id', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM branches WHERE id = $1', [req.params.id]);
    if (!rows.length) throw new AppError('Филиал не найден', 404);

    const branch = rows[0];
    const current = getBishkekTime();

    let isCurrentlyOpen = branch.is_open;
    if (isCurrentlyOpen && !branch.is_24h) {
        isCurrentlyOpen = current >= branch.working_hours_from && current <= branch.working_hours_to;
    }

    // Morning mode: dynamic hours
    const mFrom = branch.morning_hours_from || '07:00';
    const mTo = branch.morning_hours_to || '10:00';
    const isMorningMode = branch.morning_mode_enabled && current >= mFrom && current < mTo;

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
            server_time: current,
        },
    });
}));

// ─── ADMIN ───
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin' && req.admin.branch_id) {
        const { rows } = await pool.query('SELECT * FROM branches WHERE id = $1', [req.admin.branch_id]);
        return res.json({ success: true, data: rows });
    }
    const { rows } = await pool.query('SELECT * FROM branches ORDER BY sort_order');
    res.json({ success: true, data: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin') throw new AppError('Только суперадмин', 403);
    const { name, address, phone, lat, lng, working_hours_from, working_hours_to, is_24h,
        is_open, delivery_fee, min_order_amount, morning_mode_enabled,
        morning_hours_from, morning_hours_to, sort_order } = req.body;
    if (!name || !address) throw new AppError('name и address обязательны', 400);

    const { rows } = await pool.query(
        `INSERT INTO branches (name, address, phone, lat, lng, working_hours_from, working_hours_to,
                               is_24h, is_open, delivery_fee, min_order_amount, morning_mode_enabled,
                               morning_hours_from, morning_hours_to, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [name, address, phone, lat, lng, working_hours_from || '10:00', working_hours_to || '23:00',
            is_24h ?? false, is_open ?? true, delivery_fee ?? 150, min_order_amount ?? 0,
            morning_mode_enabled ?? false, morning_hours_from || '07:00', morning_hours_to || '10:00', sort_order ?? 0]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin') throw new AppError('Только суперадмин', 403);
    const { name, address, phone, lat, lng, working_hours_from, working_hours_to, is_24h,
        is_open, delivery_fee, min_order_amount, morning_mode_enabled,
        morning_hours_from, morning_hours_to, sort_order } = req.body;

    const { rows } = await pool.query(
        `UPDATE branches SET name=$1, address=$2, phone=$3, lat=$4, lng=$5,
                             working_hours_from=$6, working_hours_to=$7, is_24h=$8, is_open=$9,
                             delivery_fee=$10, min_order_amount=$11, morning_mode_enabled=$12,
                             morning_hours_from=$13, morning_hours_to=$14, sort_order=$15
         WHERE id=$16 RETURNING *`,
        [name, address, phone, lat, lng, working_hours_from, working_hours_to,
            is_24h, is_open, delivery_fee, min_order_amount, morning_mode_enabled,
            morning_hours_from, morning_hours_to, sort_order, req.params.id]
    );
    if (!rows.length) throw new AppError('Не найден', 404);
    res.json({ success: true, data: rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    if (req.admin.role !== 'superadmin') throw new AppError('Только суперадмин', 403);
    await pool.query('DELETE FROM branches WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Удалено' });
}));

// ─── Office addresses ───
router.get('/:branchId/offices', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM office_addresses WHERE branch_id = $1 ORDER BY sort_order', [req.params.branchId]);
    res.json({ success: true, data: rows });
}));

router.post('/:branchId/offices', asyncHandler(async (req, res) => {
    const { name, address } = req.body;
    if (!name || !address) throw new AppError('name и address обязательны', 400);
    const { rows } = await pool.query(
        'INSERT INTO office_addresses (branch_id, name, address) VALUES ($1,$2,$3) RETURNING *',
        [req.params.branchId, name, address]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

router.delete('/offices/:id', asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM office_addresses WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Удалено' });
}));

// ─── Category links ───
router.get('/:branchId/categories', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT c.*, CASE WHEN cb.id IS NOT NULL THEN true ELSE false END as is_linked
        FROM categories c LEFT JOIN category_branches cb ON cb.category_id = c.id AND cb.branch_id = $1
        ORDER BY c.sort_order
    `, [req.params.branchId]);
    res.json({ success: true, data: rows });
}));

router.post('/:branchId/categories', asyncHandler(async (req, res) => {
    const { category_ids } = req.body;
    if (!Array.isArray(category_ids)) throw new AppError('category_ids должен быть массивом', 400);
    await pool.query('DELETE FROM category_branches WHERE branch_id = $1', [req.params.branchId]);
    for (const catId of category_ids) {
        await pool.query('INSERT INTO category_branches (category_id, branch_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [catId, req.params.branchId]);
    }
    res.json({ success: true, message: `Привязано ${category_ids.length} категорий` });
}));


// ─── Item overrides per branch ───
router.get('/:branchId/overrides', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`
        SELECT i.id as item_id, i.name_ru, i.price as base_price, i.status::text as base_status,
               c.name_ru as category_name,
               bio.price as override_price, bio.status as override_status
        FROM items i
        JOIN categories c ON c.id = i.category_id
        JOIN category_branches cb ON cb.category_id = c.id AND cb.branch_id = $1
        LEFT JOIN branch_item_overrides bio ON bio.item_id = i.id AND bio.branch_id = $1
        ORDER BY c.sort_order, i.sort_order
    `, [req.params.branchId]);
    res.json({ success: true, data: rows });
}));

router.put('/:branchId/overrides', asyncHandler(async (req, res) => {
    const { overrides } = req.body; // [{ item_id, price, status }]
    if (!Array.isArray(overrides)) throw new AppError('overrides должен быть массивом', 400);

    for (const o of overrides) {
        if (!o.item_id) continue;

        // If both null — remove override (use base values)
        if (o.price === null && o.status === null) {
            await pool.query('DELETE FROM branch_item_overrides WHERE branch_id=$1 AND item_id=$2',
                [req.params.branchId, o.item_id]);
        } else {
            await pool.query(`
                INSERT INTO branch_item_overrides (branch_id, item_id, price, status)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (branch_id, item_id) DO UPDATE SET price=$3, status=$4
            `, [req.params.branchId, o.item_id, o.price || null, o.status || null]);
        }
    }
    res.json({ success: true, message: 'Оверрайды сохранены' });
}));

module.exports = router;