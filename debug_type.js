const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkType() {
    let connection;
    try {
        const dbModule = require('./config/db');
        let pool = dbModule.getConnection ? dbModule : (dbModule.then ? await dbModule : await dbModule);
        connection = await pool.getConnection();

        const vnPrefix = 'VN681216%';
        const [vnMaxResult] = await connection.execute(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(VNO, 9, 3) AS UNSIGNED)), 0) as max_number
            FROM TREATMENT1 
            WHERE VNO LIKE ?
        `, [vnPrefix]);

        const val = vnMaxResult[0].max_number;
        console.log('Value:', val);
        console.log('Type:', typeof val);
        console.log('Is String?', typeof val === 'string');
        console.log('Result of val + 1:', val + 1);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

checkType();
