const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanData() {
    let connection;
    try {
        const dbModule = require('./config/db');
        let pool = dbModule.getConnection ? dbModule : (dbModule.then ? await dbModule : await dbModule);
        connection = await pool.getConnection();

        const vnPrefix = 'VN681216%';
        console.log(`Searching for records with VNO like ${vnPrefix}...`);

        const [rows] = await connection.query(`SELECT VNO FROM TREATMENT1 WHERE VNO LIKE ?`, [vnPrefix]);

        if (rows.length === 0) {
            console.log('No records found to delete.');
            return;
        }

        console.log(`Found ${rows.length} records. Deleting...`);

        await connection.beginTransaction();

        try {
            // Delete related tables first (to avoid FK errors if they exist, or just for cleanliness)
            // Using IN clause for efficiency
            const vnos = rows.map(r => r.VNO);
            const placeholders = vnos.map(() => '?').join(',');

            // List of tables linked to VNO (based on treatment.js delete logic)
            const subTables = [
                'TREATMENT1_DIAGNOSIS',
                'TREATMENT1_DRUG', // Assuming this exists based on common schema, though repair_db didn't catch it
                'TREATMENT1_MED_PROCEDURE', // Assuming
                'TREATMENT1_LABORATORY', // Assuming
                'TREATMENT1_RADIOLOGICAL' // Assuming
            ];

            // Wait, let's check which tables actually exist or fail gracefully
            // better to loop and delete by VNO if volume is low (it is, only 3 records)
            // or just try DELETE FROM subtable WHERE VNO IN (...)

            for (const table of subTables) {
                try {
                    await connection.query(`DELETE FROM ${table} WHERE VNO IN (${placeholders})`, vnos);
                    console.log(`Deleted from ${table}`);
                } catch (e) {
                    // Ignore table not found
                    if (e.code !== 'ER_NO_SUCH_TABLE') console.log(`Warning deleting from ${table}: ${e.message}`);
                }
            }

            // Delete from main table
            await connection.query(`DELETE FROM TREATMENT1 WHERE VNO IN (${placeholders})`, vnos);
            console.log(`Deleted ${rows.length} records from TREATMENT1`);

            await connection.commit();
            console.log('✅ Cleanup successful.');

        } catch (err) {
            await connection.rollback();
            throw err;
        }

    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

cleanData();
