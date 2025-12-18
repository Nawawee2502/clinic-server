const mysql = require('mysql2/promise');
require('dotenv').config();

async function addClaimActualAmountColumn() {
    console.log('🚀 Starting schema update: Adding CLAIM_ACTUAL_AMOUNT column...');

    // Create connection
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('✅ Connected to database');

        // Check if column exists
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'TREATMENT1' AND COLUMN_NAME = 'CLAIM_ACTUAL_AMOUNT'
        `, [process.env.DB_NAME]);

        if (columns.length > 0) {
            console.log('⚠️ Column CLAIM_ACTUAL_AMOUNT already exists. Skipping...');
        } else {
            console.log('📝 Adding CLAIM_ACTUAL_AMOUNT column...');
            await connection.execute(`
                ALTER TABLE TREATMENT1 
                ADD COLUMN CLAIM_ACTUAL_AMOUNT DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'ยอดที่เคลมจริง (Actual - Received)' AFTER ACTUAL_PRICE
            `);
            console.log('✅ Column CLAIM_ACTUAL_AMOUNT added successfully');
        }

    } catch (error) {
        console.error('❌ Error updating schema:', error);
    } finally {
        await connection.end();
        console.log('👋 Connection closed');
    }
}

addClaimActualAmountColumn();
