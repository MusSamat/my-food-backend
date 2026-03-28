require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');

(async () => {
    try {
        // Получаем первые ДВА филиала
        const { rows: branches } = await pool.query('SELECT id, name FROM branches ORDER BY id LIMIT 2');

        if (!branches.length) {
            console.error('Сначала создайте хотя бы один филиал (npm run migrate)');
            process.exit(1);
        }

        // --- СОЗДАНИЕ ПЕРВОГО ОПЕРАТОРА ---
        const branch1 = branches[0];
        const hash1 = await bcrypt.hash('operator123', 10);

        await pool.query(`
            INSERT INTO admins (username, password_hash, name, role, branch_id, is_active)
            VALUES ('operator', $1, 'Оператор 1', 'operator', $2, true)
                ON CONFLICT (username) DO UPDATE SET password_hash = $1, role = 'operator', branch_id = $2
        `, [hash1, branch1.id]);

        console.log(`✅ Operator 1 created: operator / operator123 (branch: ${branch1.name}, id: ${branch1.id})`);

        // --- СОЗДАНИЕ ВТОРОГО ОПЕРАТОРА (если есть второй филиал) ---
        if (branches.length > 1) {
            const branch2 = branches[1];
            // Используем тот же пароль или можем сгенерировать новый
            const hash2 = await bcrypt.hash('operator123', 10);

            await pool.query(`
                INSERT INTO admins (username, password_hash, name, role, branch_id, is_active)
                VALUES ('operator2', $1, 'Оператор 2', 'operator', $2, true)
                ON CONFLICT (username) DO UPDATE SET password_hash = $1, role = 'operator', branch_id = $2
            `, [hash2, branch2.id]);

            console.log(`✅ Operator 2 created: operator2 / operator123 (branch: ${branch2.name}, id: ${branch2.id})`);
        } else {
            console.log('⚠️ В базе найден только один филиал. Второй оператор не создан.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        // Обязательно закрываем соединение с БД
        await pool.end();
    }
})();