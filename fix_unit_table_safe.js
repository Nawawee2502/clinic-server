const db = require('./config/db');

async function fix() {
    try {
        const conn = await db.getConnection();

        console.log('--- CLEANING TABLE_UNIT (SAFE MODE) ---');

        // 1. Disable FK Checks
        await conn.query('SET FOREIGN_KEY_CHECKS=0');

        // 2. Identify duplicates and delete them.
        // Since we don't have a unique ID, we can't easily delete "duplicates" safely with standard SQL 
        // without a temporary table trick or DELETE with LIMIT.
        // Strategy: Create a new temp table with unique data, truncate original, refill.

        await conn.execute(`CREATE TABLE IF NOT EXISTS TABLE_UNIT_SAFE LIKE TABLE_UNIT`);
        await conn.execute(`TRUNCATE TABLE TABLE_UNIT_SAFE`);

        // Insert DISTINCT data
        await conn.execute(`INSERT INTO TABLE_UNIT_SAFE SELECT DISTINCT * FROM TABLE_UNIT GROUP BY UNIT_CODE`);

        // Check counts
        const [orig] = await conn.execute(`SELECT COUNT(*) as c FROM TABLE_UNIT`);
        const [safe] = await conn.execute(`SELECT COUNT(*) as c FROM TABLE_UNIT_SAFE`);
        console.log(`Original count: ${orig[0].c}, Unique count: ${safe[0].c}`);

        // Truncate original
        await conn.execute(`TRUNCATE TABLE TABLE_UNIT`);

        // Fill original from safe
        await conn.execute(`INSERT INTO TABLE_UNIT SELECT * FROM TABLE_UNIT_SAFE`);

        // Drop safe table
        await conn.execute(`DROP TABLE TABLE_UNIT_SAFE`);

        // 3. ADD PRIMARY KEY
        console.log('Adding Primary Key...');
        // First check if index/key already exists to avoid error
        try {
            await conn.execute(`ALTER TABLE TABLE_UNIT ADD PRIMARY KEY (UNIT_CODE)`);
            console.log('✅ PK Added.');
        } catch (pkErr) {
            console.log('⚠️ Could not add PK (maybe exists or duplicates remain):', pkErr.message);
        }

        // 4. Enable FK Checks
        await conn.query('SET FOREIGN_KEY_CHECKS=1');

        const [units] = await conn.execute(`SELECT * FROM TABLE_UNIT`);
        console.table(units);

        conn.release();
    } catch (e) {
        console.error('FAILED:', e);
    }
    process.exit();
}

fix();
