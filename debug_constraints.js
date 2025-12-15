const mysql = require('mysql2/promise');
const config = require('./config/db');

// Extract config object from the module if needed, or use directly
// Assuming config/db.js exports a pool or config object. 
// Let's try to load it and interpret.

async function checkConstraints() {
    let connection;
    try {
        // Try to require the pool directly
        const dbModule = require('./config/db');

        // If it's a pool, get connection. If it creates a pool promise, await it.
        let pool;
        if (dbModule.getConnection) {
            pool = dbModule;
        } else if (dbModule.then) {
            pool = await dbModule;
        } else {
            // Assume it exports config or something else, try to create connection from env if possible
            // But for now let's hope it's the pool promise pattern seen in routes
            pool = await dbModule;
        }

        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT DATABASE() as db');
        const dbName = rows[0].db;
        console.log(`Checking constraints for database: ${dbName}`);

        const tables = ['patient1', 'DAILY_QUEUE', 'TREATMENT1', 'APPOINTMENT_SCHEDULE'];

        for (const table of tables) {
            console.log(`\n--- Table: ${table} ---`);

            // Check PK
            const [pkStats] = await connection.query(`
        SHOW KEYS FROM ${table} WHERE Key_name = 'PRIMARY'
      `);
            if (pkStats.length > 0) {
                console.log(`✅ Primary Key: ${pkStats.map(k => k.Column_name).join(', ')}`);
            } else {
                console.log(`❌ Missing Primary Key!`);
            }

            // Check FKs
            const [fks] = await connection.query(`
        SELECT 
          CONSTRAINT_NAME, 
          COLUMN_NAME, 
          REFERENCED_TABLE_NAME, 
          REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [dbName, table]);

            if (fks.length > 0) {
                fks.forEach(fk => {
                    console.log(`✅ FK ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}(${fk.REFERENCED_COLUMN_NAME})`);
                });
            } else {
                console.log(`⚠️ No Foreign Keys found (might be intentional if constraints were removed)`);
            }

            // Check for columns that SHOULD look like FKs
            const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
            const suspicious = columns.filter(c =>
                (c.Field.includes('HN') || c.Field.includes('QUEUE') || c.Field.includes('VNO')) &&
                !fks.find(f => f.COLUMN_NAME === c.Field) &&
                c.Key !== 'PRI'
            );

            if (suspicious.length > 0) {
                suspicious.forEach(c => {
                    console.log(`❓ Potential missing FK for column: ${c.Field}`);
                });
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

checkConstraints();
