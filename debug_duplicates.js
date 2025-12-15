const mysql = require('mysql2/promise');
const config = require('./config/db');

async function checkDuplicates() {
    let connection;
    try {
        const dbModule = require('./config/db');
        let pool = dbModule.getConnection ? dbModule : (dbModule.then ? await dbModule : await dbModule);
        connection = await pool.getConnection();

        console.log('Checking for duplicates in TREATMENT1.VNO...');
        const [dupes] = await connection.query(`
        SELECT VNO, COUNT(*) as count 
        FROM TREATMENT1 
        GROUP BY VNO 
        HAVING count > 1
    `);

        if (dupes.length > 0) {
            console.log(`❌ Found ${dupes.length} duplicate VNAs:`);
            dupes.forEach(d => console.log(` - ${d.VNO}: ${d.count} records`));
        } else {
            console.log('✅ No duplicate VNOs found. Safe to add Primary Key.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

checkDuplicates();
