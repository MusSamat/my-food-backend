const UP = `
-- Типы ENUM
CREATE TYPE item_status AS ENUM ('available', 'coming_soon', 'out_of_stock', 'hidden');
CREATE TYPE order_type AS ENUM ('delivery', 'pickup');
CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE promo_type AS ENUM ('percent', 'fixed');
CREATE TYPE printer_connection AS ENUM ('usb', 'lan', 'browser');
CREATE TYPE paper_width AS ENUM ('80mm', '58mm');

-- Админы
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(200),
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Категории
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name_ru VARCHAR(200) NOT NULL,
    name_kg VARCHAR(200),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Блюда (items)
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name_ru VARCHAR(300) NOT NULL,
    name_kg VARCHAR(300),
    description_ru TEXT,
    description_kg TEXT,
    ingredients TEXT,
    price INTEGER NOT NULL,
    image_url VARCHAR(500),
    status item_status DEFAULT 'available',
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_popular ON items(is_popular) WHERE is_popular = true;

-- Офисы / филиалы
CREATE TABLE offices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    address VARCHAR(500) NOT NULL,
    phone VARCHAR(50),
    working_hours VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Промокоды
CREATE TABLE promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    type promo_type NOT NULL,
    value INTEGER NOT NULL,
    min_order INTEGER DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promo_code ON promo_codes(code);

-- Заказы
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    telegram_username VARCHAR(200),
    type order_type NOT NULL DEFAULT 'delivery',
    status order_status NOT NULL DEFAULT 'pending_payment',
    
    -- Контакт
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    
    -- Доставка
    address VARCHAR(500),
    apartment VARCHAR(50),
    floor VARCHAR(20),
    entrance VARCHAR(20),
    courier_comment TEXT,
    
    -- Самовывоз
    office_id INTEGER REFERENCES offices(id),
    
    -- Общий комментарий
    comment TEXT,
    cutlery_count INTEGER DEFAULT 1,
    
    -- Суммы
    subtotal INTEGER NOT NULL,
    discount INTEGER DEFAULT 0,
    delivery_fee INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    
    -- Промокод
    promo_id INTEGER REFERENCES promo_codes(id),
    promo_code VARCHAR(50),
    
    -- Оплата
    payment_id VARCHAR(200),
    payment_status payment_status DEFAULT 'pending',
    payment_url VARCHAR(500),
    paid_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_telegram_user ON orders(telegram_user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_payment ON orders(payment_id);

-- Позиции заказа
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    item_name VARCHAR(300) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- История статусов
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    changed_by VARCHAR(200),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_history_order ON order_status_history(order_id);

-- Настройки принтера
CREATE TABLE printer_settings (
    id SERIAL PRIMARY KEY,
    connection_type printer_connection DEFAULT 'browser',
    ip_address VARCHAR(50),
    port INTEGER DEFAULT 9100,
    paper_width paper_width DEFAULT '80mm',
    auto_print_kitchen BOOLEAN DEFAULT false,
    auto_print_client BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Функция автообновления updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры
CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON offices FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON promo_codes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Дефолтные данные
INSERT INTO printer_settings (connection_type, paper_width) VALUES ('browser', '80mm');
`;

const DOWN = `
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS offices CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS printer_settings CASCADE;
DROP TYPE IF EXISTS item_status CASCADE;
DROP TYPE IF EXISTS order_type CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS promo_type CASCADE;
DROP TYPE IF EXISTS printer_connection CASCADE;
DROP TYPE IF EXISTS paper_width CASCADE;
DROP FUNCTION IF EXISTS update_timestamp CASCADE;
`;

module.exports = { UP, DOWN };
