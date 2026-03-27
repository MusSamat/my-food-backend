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
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_branches BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Офисные адреса для утреннего режима
CREATE TABLE IF NOT EXISTS office_addresses (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(300) NOT NULL,
    address VARCHAR(500) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_addresses_branch ON office_addresses(branch_id);

-- Связка категорий с филиалами
CREATE TABLE IF NOT EXISTS category_branches (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE(category_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_cb_category ON category_branches(category_id);
CREATE INDEX IF NOT EXISTS idx_cb_branch ON category_branches(branch_id);

-- Расширяем admins: role + branch_id
ALTER TABLE admins ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
DO $$ BEGIN
    ALTER TABLE admins ALTER COLUMN role SET DEFAULT 'operator';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Обновляем существующего admin на superadmin
UPDATE admins SET role = 'superadmin' WHERE username = 'admin' AND role = 'admin';

-- Расширяем orders: branch_id
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Дефолтный филиал
INSERT INTO branches (name, address, phone, is_24h, delivery_fee, min_order_amount)
SELECT 'Главный', 'г. Бишкек', '', true, 
    COALESCE((SELECT delivery_fee FROM restaurant_settings ORDER BY id LIMIT 1), 150),
    COALESCE((SELECT min_order_amount FROM restaurant_settings ORDER BY id LIMIT 1), 0)
WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1);

-- Привязать все категории к дефолтному филиалу
INSERT INTO category_branches (category_id, branch_id)
SELECT c.id, b.id FROM categories c CROSS JOIN (SELECT id FROM branches ORDER BY id LIMIT 1) b
ON CONFLICT DO NOTHING;
`;

const DOWN = `
ALTER TABLE orders DROP COLUMN IF EXISTS branch_id;
ALTER TABLE admins DROP COLUMN IF EXISTS branch_id;
DROP TABLE IF EXISTS category_branches CASCADE;
DROP TABLE IF EXISTS office_addresses CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
`;

module.exports = { UP, DOWN };