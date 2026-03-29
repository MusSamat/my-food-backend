const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

// PUBLIC: get zones (for mini app to calculate fee)
router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM delivery_zones WHERE is_active = true ORDER BY sort_order');
    res.json({ success: true, data: rows });
}));

// Check which zone a point falls into
router.post('/check', asyncHandler(async (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) throw new AppError('lat и lng обязательны', 400);

    const { rows: zones } = await pool.query('SELECT * FROM delivery_zones WHERE is_active = true ORDER BY sort_order');

    // Point-in-polygon check
    const isInside = (point, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];
            if (((yi > point[1]) !== (yj > point[1])) && (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    };

    const matchedZone = zones.find(z => z.polygon && isInside([lat, lng], z.polygon));

    res.json({
        success: true,
        data: matchedZone ? { zone_id: matchedZone.id, name: matchedZone.name, fee: matchedZone.fee, min_order: matchedZone.min_order }
            : null,
    });
}));

// ADMIN
router.use(authMiddleware);

router.post('/', asyncHandler(async (req, res) => {
    const { name, fee, min_order, polygon } = req.body;
    if (!name) throw new AppError('name обязательно', 400);
    const { rows } = await pool.query(
        'INSERT INTO delivery_zones (name, fee, min_order, polygon) VALUES ($1,$2,$3,$4) RETURNING *',
        [name, fee || 0, min_order || 0, JSON.stringify(polygon || [])]
    );
    res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { name, fee, min_order, polygon, is_active } = req.body;
    const { rows } = await pool.query(
        'UPDATE delivery_zones SET name=$1, fee=$2, min_order=$3, polygon=$4, is_active=$5 WHERE id=$6 RETURNING *',
        [name, fee, min_order, JSON.stringify(polygon || []), is_active ?? true, req.params.id]
    );
    if (!rows.length) throw new AppError('Не найдена', 404);
    res.json({ success: true, data: rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM delivery_zones WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Удалено' });
}));

module.exports = router;