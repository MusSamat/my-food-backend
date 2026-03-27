require('dotenv').config();
const pool = require('../src/db/pool');
const m001 = require('../src/db/migrations/001_initial');
const m002 = require('../src/db/migrations/002_telegram_users');
const m003 = require('../src/db/migrations/003_settings_and_variants');

const direction = process.argv[2];

(async () => {
    try {
        if (direction === 'down') {
            console.log('Rolling back...');
            await pool.query(m003.DOWN);
            await pool.query(m002.DOWN);
            await pool.query(m001.DOWN);
            console.log('Done.');
        } else {
            console.log('Running migrations...');
            await pool.query(m001.UP).catch(() => console.log('001 already applied'));
            await pool.query(m002.UP).catch(() => console.log('002 already applied'));
            await pool.query(m003.UP).catch(() => console.log('003 already applied'));
            console.log('Done.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();