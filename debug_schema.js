const db = require('./config/db');

async function test() {
    try {
        const conn = await db.getConnection();

        const tables = ['TREATMENT1', 'TREATMENT1_MED_PROCEDURE', 'TABLE_UNIT'];

        for (const t of tables) {
            console.log(`\n--- CREATE TABLE ${t} ---`);
            const [rows] = await conn.execute(`SHOW CREATE TABLE ${t}`);
            console.log(rows[0]['Create Table']);
        }

        conn.release();
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

test();
