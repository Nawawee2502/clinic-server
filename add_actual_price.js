const mysql = require('mysql2/promise');
require('dotenv').config();

async function addActualPriceColumn() {
    console.log('🚀 Starting schema update: Adding ACTUAL_PRICE column...');

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
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'TREATMENT1' AND COLUMN_NAME = 'ACTUAL_PRICE'
        `, [process.env.DB_NAME]);

        if (columns.length > 0) {
            console.log('⚠️ Column ACTUAL_PRICE already exists. Skipping...');
        } else {
            console.log('📝 Adding ACTUAL_PRICE column...');
            await connection.execute(`
                ALTER TABLE TREATMENT1 
                ADD COLUMN ACTUAL_PRICE DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'ราคาจริงรวมค่ายาและค่าบริการ (สำหรับคำนวณหลังบ้าน)' AFTER NET_AMOUNT
            `);
            console.log('✅ Column ACTUAL_PRICE added successfully');
        }

    } catch (error) {
        console.error('❌ Error updating schema:', error);
    } finally {
        await connection.end();
        console.log('👋 Connection closed');
    }
}

addActualPriceColumn();
