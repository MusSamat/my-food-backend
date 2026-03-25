require('dotenv').config();
const pool = require('../src/db/pool');
const { SEED } = require('../src/db/seeds/001_demo');

(async () => {
    try {
        await SEED(pool);
    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
