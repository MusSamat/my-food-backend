const bcrypt = require('bcryptjs');

const SEED = async (pool) => {
    // Админ: login admin / password admin123
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(`
        INSERT INTO admins (username, password_hash, name, role)
        VALUES ('admin', $1, 'Администратор', 'admin')
        ON CONFLICT (username) DO NOTHING
    `, [hash]);

    // Категории
    await pool.query(`
        INSERT INTO categories (name_ru, name_kg, icon, sort_order) VALUES
        ('Суши', 'Суши', '🍣', 1),
        ('Первые блюда', 'Биринчи тамактар', '🍲', 2),
        ('Вторые блюда', 'Экинчи тамактар', '🥘', 3),
        ('Стейки', 'Стейктер', '🥩', 4),
        ('Бургеры', 'Бургерлер', '🍔', 5),
        ('Напитки', 'Суусундуктар', '🥤', 6),
        ('Десерты', 'Десерттер', '🍰', 7)
        ON CONFLICT DO NOTHING
    `);

    // Блюда
    await pool.query(`
        INSERT INTO items (category_id, name_ru, name_kg, description_ru, ingredients, price, status, is_popular, sort_order) VALUES
        (1, 'Филадельфия', 'Филадельфия', 'Классический ролл с лососем и сливочным сыром', 'лосось, сливочный сыр, рис, нори, огурец', 545, 'available', true, 1),
        (1, 'Калифорния', 'Калифорния', 'Ролл с крабовым мясом и авокадо', 'крабовое мясо, авокадо, рис, нори, икра тобико', 495, 'available', true, 2),
        (1, 'Дракон', 'Дракон', 'Запечённый ролл с угрём', 'угорь, авокадо, сливочный сыр, рис, нори, унаги соус', 645, 'available', false, 3),
        (5, 'Классик бургер', 'Классик бургер', 'Сочный бургер с говяжьей котлетой', 'говядина, булочка, салат, томат, лук, маринованные огурцы, соус', 390, 'available', true, 1),
        (5, 'Чикен бургер', 'Чикен бургер', 'Бургер с куриной котлетой', 'курица, булочка, салат, томат, соус тар-тар', 350, 'available', false, 2),
        (4, 'Рибай стейк', 'Рибай стейк', 'Мраморная говядина, 300г', 'говядина рибай, соль, перец, масло, розмарин', 1200, 'available', true, 1),
        (4, 'Филе миньон', 'Филе миньон', 'Нежнейшее филе, 250г', 'говяжья вырезка, соль, перец, тимьян', 1450, 'coming_soon', false, 2),
        (6, 'Кола 0.5л', 'Кола 0.5л', 'Coca-Cola', 'кока-кола', 80, 'available', false, 1),
        (6, 'Морс клюквенный', 'Кычкыл жидек морсу', 'Домашний морс', 'клюква, сахар, вода', 120, 'available', false, 2),
        (7, 'Тирамису', 'Тирамису', 'Итальянский десерт с маскарпоне', 'маскарпоне, савоярди, кофе, какао', 320, 'available', true, 1)
        ON CONFLICT DO NOTHING
    `);

    // Офисы
    await pool.query(`
        INSERT INTO offices (name, address, phone, working_hours) VALUES
        ('Главный офис', 'г. Бишкек, ул. Ибраимова, 115', '+996 555 123 456', '10:00 - 23:00'),
        ('Филиал Южный', 'г. Бишкек, ул. Токтогула, 89', '+996 555 654 321', '10:00 - 22:00')
        ON CONFLICT DO NOTHING
    `);

    // Промокод
    await pool.query(`
        INSERT INTO promo_codes (code, type, value, min_order, max_uses, valid_from, valid_to) VALUES
        ('WELCOME15', 'percent', 15, 500, 100, NOW(), NOW() + INTERVAL '90 days'),
        ('SALE200', 'fixed', 200, 1000, 50, NOW(), NOW() + INTERVAL '30 days')
        ON CONFLICT DO NOTHING
    `);

    console.log('Seed data inserted successfully');
};

module.exports = { SEED };
