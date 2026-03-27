require('dotenv').config();
const pool = require('../src/db/pool');
const m001 = require('../src/db/migrations/001_initial');
const m002 = require('../src/db/migrations/002_telegram_users');
const m003 = require('../src/db/migrations/003_settings_and_variants');
const m004 = require('../src/db/migrations/004_branches');

const direction = process.argv[2];

(async () => {
    try {
        if (direction === 'down') {
            console.log('Rolling back...');
            await pool.query(m004.DOWN).catch(e => console.log('004 down:', e.message));
            await pool.query(m003.DOWN).catch(e => console.log('003 down:', e.message));
            await pool.query(m002.DOWN).catch(e => console.log('002 down:', e.message));
            await pool.query(m001.DOWN).catch(e => console.log('001 down:', e.message));
            console.log('Done.');
        } else {
            console.log('Running migrations...');
            await pool.query(m001.UP).then(() => console.log('001 applied')).catch(() => console.log('001 skip'));
            await pool.query(m002.UP).then(() => console.log('002 applied')).catch(() => console.log('002 skip'));
            await pool.query(m003.UP).then(() => console.log('003 applied')).catch(() => console.log('003 skip'));
            await pool.query(m004.UP).then(() => console.log('004 applied')).catch(e => console.log('004 error:', e.message));
            console.log('Done.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();