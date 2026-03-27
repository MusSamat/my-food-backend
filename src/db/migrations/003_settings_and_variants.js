const UP = `
-- Настройки ресторана (доставка, мин. заказ, время работы)
CREATE TABLE IF NOT EXISTS restaurant_settings (
    id SERIAL PRIMARY KEY,
    delivery_fee INTEGER DEFAULT 150,
    min_order_amount INTEGER DEFAULT 0,
    working_hours_from VARCHAR(5) DEFAULT '10:00',
    working_hours_to VARCHAR(5) DEFAULT '23:00',
    is_open BOOLEAN DEFAULT true,
    currency VARCHAR(10) DEFAULT 'сом',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO restaurant_settings (delivery_fee, min_order_amount, working_hours_from, working_hours_to)
VALUES (150, 300, '10:00', '23:00')
ON CONFLICT DO NOTHING;

-- Варианты блюд (размеры, добавки)
CREATE TABLE IF NOT EXISTS item_variants (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    price_diff INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_item_variants_item ON item_variants(item_id);

-- Группы вариантов (Размер, Добавки, Острота)
CREATE TABLE IF NOT EXISTS variant_groups (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) DEFAULT 'single',
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS variant_options (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES variant_groups(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    price_diff INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false
);

-- Избранное
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(telegram_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(telegram_id);

-- Отзывы
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);

-- Зоны доставки
CREATE TABLE IF NOT EXISTS delivery_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    fee INTEGER NOT NULL DEFAULT 150,
    min_order INTEGER DEFAULT 0,
    polygon JSONB,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const DOWN = `
DROP TABLE IF EXISTS delivery_zones CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS variant_options CASCADE;
DROP TABLE IF EXISTS variant_groups CASCADE;
DROP TABLE IF EXISTS item_variants CASCADE;
DROP TABLE IF EXISTS restaurant_settings CASCADE;
`;

module.exports = { UP, DOWN };