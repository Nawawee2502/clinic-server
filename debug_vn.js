const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkVN() {
    let connection;
    try {
        const dbModule = require('./config/db');
        let pool = dbModule.getConnection ? dbModule : (dbModule.then ? await dbModule : await dbModule);
        connection = await pool.getConnection();

        // 681216
        const vnPrefix = 'VN681216%';
        console.log(`Checking VNs like ${vnPrefix}...`);

        const [rows] = await connection.query(`
            SELECT VNO 
            FROM TREATMENT1 
            WHERE VNO LIKE ?
            ORDER BY VNO
        `, [vnPrefix]);

        console.log('Found VNs:', rows.map(r => r.VNO));

        // Check MAX logic
        const [vnMaxResult] = await connection.execute(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(VNO, 9, 3) AS UNSIGNED)), 0) as max_number
            FROM TREATMENT1 
            WHERE VNO LIKE ?
        `, [vnPrefix]);

        console.log('MAX calculation result:', vnMaxResult[0].max_number);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

checkVN();
