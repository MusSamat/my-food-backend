
const UP = `
CREATE TABLE IF NOT EXISTS telegram_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(200),
    first_name VARCHAR(200),
    last_name VARCHAR(200),
    phone VARCHAR(50),
    birthday VARCHAR(20),
    office_phone VARCHAR(50),
    saved_address VARCHAR(500),
    saved_apartment VARCHAR(50),
    saved_floor VARCHAR(20),
    saved_entrance VARCHAR(20),
    saved_office_id INTEGER REFERENCES offices(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_address VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tg_users_telegram_id ON telegram_users(telegram_id);

CREATE TRIGGER set_updated_at_tg_users BEFORE UPDATE ON telegram_users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
`;

const DOWN = `
DROP TABLE IF EXISTS telegram_users CASCADE;
`;

module.exports = { UP, DOWN };