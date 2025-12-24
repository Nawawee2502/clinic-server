
require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'clinic_db',
    port: process.env.DB_PORT || 3306
};

async function checkDateCounts() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const targetDate = '2025-12-21';

        // 1. Total records for the date
        const [totalRows] = await connection.execute(
            `SELECT COUNT(*) as total FROM TREATMENT1 WHERE DATE(RDATE) = ?`,
            [targetDate]
        );
        console.log(`\nTotal records for ${targetDate}: ${totalRows[0].total}`);

        // 2. Records grouped by PAYMENT_STATUS
        const [statusRows] = await connection.execute(
            `SELECT PAYMENT_STATUS, COUNT(*) as count 
             FROM TREATMENT1 
             WHERE DATE(RDATE) = ? 
             GROUP BY PAYMENT_STATUS`,
            [targetDate]
        );

        console.log(`\nBreakdown by PAYMENT_STATUS:`);
        statusRows.forEach(row => {
            console.log(`- ${row.PAYMENT_STATUS || 'NULL'}: ${row.count}`);
        });

        // 3. Records grouped by STATUS1 (sometimes used alternatively)
        const [status1Rows] = await connection.execute(
            `SELECT STATUS1, COUNT(*) as count 
             FROM TREATMENT1 
             WHERE DATE(RDATE) = ? 
             GROUP BY STATUS1`,
            [targetDate]
        );

        console.log(`\nBreakdown by STATUS1:`);
        status1Rows.forEach(row => {
            console.log(`- ${row.STATUS1 || 'NULL'}: ${row.count}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkDateCounts();
