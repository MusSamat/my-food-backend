const { Router } = require('express');
const pool = require('../../db/pool');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');
const authMiddleware = require('../../middleware/auth');

const router = Router();

// Point-in-polygon algorithm (ray casting)
const pointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return false;
    const [px, py] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
};

// PUBLIC: all active zones
router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM delivery_zones WHERE is_active = true ORDER BY sort_order');
    res.json({ success: true, data: rows });
}));

// PUBLIC: check which zone a coordinate falls into
router.post('/check', asyncHandler(async (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) throw new AppError('lat и lng обязательны', 400);

    const { rows: zones } = await pool.query('SELECT * FROM delivery_zones WHERE is_active = true ORDER BY sort_order');

    const matched = zones.find(z => z.polygon && pointInPolygon([lat, lng], z.polygon));

    res.json({
        success: true,
        data: matched
            ? { zone_id: matched.id, name: matched.name, fee: matched.fee, min_order: matched.min_order }
            : null,
    });
}));

// PUBLIC: geocode address → find zone (for typed addresses)
router.post('/check-address', asyncHandler(async (req, res) => {
    const { address } = req.body;
    if (!address) throw new AppError('address обязателен', 400);

    // Geocode via Nominatim (free, no API key)
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Бишкек, Кыргызстан')}&format=json&limit=1`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'FoodDeliveryApp/1.0' },
        });
        const results = await response.json();

        if (!results.length) {
            return res.json({ success: true, data: null, geocoded: false });
        }

        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);

        // Check zones
        const { rows: zones } = await pool.query('SELECT * FROM delivery_zones WHERE is_active = true ORDER BY sort_order');
        const matched = zones.find(z => z.polygon && pointInPolygon([lat, lng], z.polygon));

        res.json({
            success: true,
            data: matched
                ? { zone_id: matched.id, name: matched.name, fee: matched.fee, min_order: matched.min_order, lat, lng }
                : null,
            geocoded: true,
            coordinates: { lat, lng },
        });
    } catch {
        res.json({ success: true, data: null, geocoded: false });
    }
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