require('dotenv').config();
const db = require('./config/db');

async function migrate() {
    try {
        console.log('🔄 Running migration: Add UCS_CARD to TABLE_MEDICAL_PROCEDURES...');

        // เช็คก่อนว่า column มีอยู่แล้วไหม
        const [cols] = await db.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'TABLE_MEDICAL_PROCEDURES'
              AND COLUMN_NAME = 'UCS_CARD'
        `);

        if (cols.length > 0) {
            console.log('✅ UCS_CARD column already exists in TABLE_MEDICAL_PROCEDURES — skipping');
        } else {
            await db.execute(`
                ALTER TABLE TABLE_MEDICAL_PROCEDURES
                ADD COLUMN UCS_CARD CHAR(1) NOT NULL DEFAULT 'N'
                    COMMENT 'Y = บัตรทองครอบคลุม (ไม่ต้องจ่าย), N = ต้องจ่ายเอง'
            `);
            console.log('✅ Added UCS_CARD column to TABLE_MEDICAL_PROCEDURES (default N)');
        }

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

migrate();
