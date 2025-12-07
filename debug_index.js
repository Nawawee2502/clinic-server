const db = require('./config/db');

async function test() {
    try {
        const conn = await db.getConnection();

        console.log('--- INDEXES TREATMENT1 ---');
        const [idx1] = await conn.execute(`SHOW INDEX FROM TREATMENT1`);
        console.table(idx1);

        console.log('--- INDEXES TABLE_UNIT ---');
        const [idx2] = await conn.execute(`SHOW INDEX FROM TABLE_UNIT`);
        console.table(idx2);

        conn.release();
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

test();
