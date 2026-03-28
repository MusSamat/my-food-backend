const UP = `
-- Филиалы
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    address VARCHAR(500) NOT NULL,
    phone VARCHAR(50),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    working_hours_from VARCHAR(5) DEFAULT '10:00',
    working_hours_to VARCHAR(5) DEFAULT '23:00',
    is_24h BOOLEAN DEFAULT false,
    is_open BOOLEAN DEFAULT true,
    delivery_fee INTEGER DEFAULT 150,
    min_order_amount INTEGER DEFAULT 0,
    morning_mode_enabled BOOLEAN DEFAULT false,
    morning_hours_from VARCHAR(5) DEFAULT '07:00',
    morning_hours_to VARCHAR(5) DEFAULT '10:00',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_branches ON branches;
CREATE TRIGGER set_updated_at_branches BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Офисные адреса (утренний режим)
CREATE TABLE IF NOT EXISTS office_addresses (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(300) NOT NULL,
    address VARCHAR(500) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_addr_branch ON office_addresses(branch_id);

-- Связка категорий с филиалами (many-to-many)
CREATE TABLE IF NOT EXISTS category_branches (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE(category_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_cb_category ON category_branches(category_id);
CREATE INDEX IF NOT EXISTS idx_cb_branch ON category_branches(branch_id);

-- Оверрайды блюд по филиалу (цена, статус)
CREATE TABLE IF NOT EXISTS branch_item_overrides (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    price INTEGER,
    status VARCHAR(20),
    UNIQUE(branch_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_bio_branch ON branch_item_overrides(branch_id);
CREATE INDEX IF NOT EXISTS idx_bio_item ON branch_item_overrides(item_id);

-- Расширяем admins: branch_id для оператора
ALTER TABLE admins ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Расширяем orders: branch_id
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Обновить существующего admin на superadmin
UPDATE admins SET role = 'superadmin' WHERE username = 'admin';

-- Создать дефолтный филиал если нет ни одного
INSERT INTO branches (name, address, is_24h, delivery_fee, min_order_amount)
SELECT 'Главный', 'г. Бишкек', true,
    COALESCE((SELECT delivery_fee FROM restaurant_settings ORDER BY id LIMIT 1), 150),
    COALESCE((SELECT min_order_amount FROM restaurant_settings ORDER BY id LIMIT 1), 0)
WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1);

-- Привязать все категории к дефолтному филиалу
INSERT INTO category_branches (category_id, branch_id)
SELECT c.id, b.id FROM categories c CROSS JOIN (SELECT id FROM branches ORDER BY id LIMIT 1) b
ON CONFLICT DO NOTHING;

-- Привязать все существующие заказы к дефолтному филиалу
UPDATE orders SET branch_id = (SELECT id FROM branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL;
`;

const DOWN = `
    ALTER TABLE orders DROP COLUMN IF EXISTS branch_id;
    ALTER TABLE admins DROP COLUMN IF EXISTS branch_id;
    DROP TABLE IF EXISTS branch_item_overrides CASCADE;
    DROP TABLE IF EXISTS category_branches CASCADE;
    DROP TABLE IF EXISTS office_addresses CASCADE;
    DROP TABLE IF EXISTS branches CASCADE;
`;

module.exports = { UP, DOWN };