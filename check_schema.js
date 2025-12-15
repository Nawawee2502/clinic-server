const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
    let connection;
    try {
        const dbModule = require('./config/db');
        let pool = dbModule.getConnection ? dbModule : (dbModule.then ? await dbModule : await dbModule);
        connection = await pool.getConnection();

        const [columns] = await connection.query('DESCRIBE TREATMENT1');
        console.log('Schema for TREATMENT1:');
        columns.forEach(c => {
            console.log(`${c.Field}: Type=${c.Type}, Null=${c.Null}, Default=${c.Default}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

checkSchema();
