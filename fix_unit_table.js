const db = require('./config/db');

async function fix() {
    try {
        const conn = await db.getConnection();

        console.log('--- CLEANING TABLE_UNIT ---');

        // 1. Create temporary table with distinct values
        await conn.execute(`CREATE TABLE TABLE_UNIT_TEMP LIKE TABLE_UNIT`);
        await conn.execute(`INSERT INTO TABLE_UNIT_TEMP SELECT DISTINCT * FROM TABLE_UNIT GROUP BY UNIT_CODE`);

        // 2. Drop old table
        await conn.execute(`DROP TABLE TABLE_UNIT`);

        // 3. Rename new table
        await conn.execute(`RENAME TABLE TABLE_UNIT_TEMP TO TABLE_UNIT`);

        // 4. ADD PRIMARY KEY
        console.log('Adding Primary Key...');
        await conn.execute(`ALTER TABLE TABLE_UNIT ADD PRIMARY KEY (UNIT_CODE)`);

        console.log('✅ TABLE_UNIT fixed. Duplicates removed and PK added.');

        const [units] = await conn.execute(`SELECT * FROM TABLE_UNIT`);
        console.table(units);

        conn.release();
    } catch (e) {
        console.error('FAILED:', e);
    }
    process.exit();
}

fix();
