const db = require('./config/db');

async function migrate() {
    try {
        const conn = await db.getConnection();

        console.log('Checking if ID_TYPE column exists in patient1...');
        const [columns] = await conn.execute(`SHOW COLUMNS FROM patient1 LIKE 'ID_TYPE'`);

        if (columns.length === 0) {
            console.log('Adding ID_TYPE column...');
            await conn.execute(`
                ALTER TABLE patient1 
                ADD COLUMN ID_TYPE VARCHAR(20) DEFAULT 'IDCARD' AFTER IDNO
            `);
            console.log('✅ ID_TYPE column added successfully.');
        } else {
            console.log('ℹ️ ID_TYPE column already exists.');
        }

        conn.release();
    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit();
}

migrate();
