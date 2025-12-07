const db = require('./config/db');

async function test() {
    try {
        const conn = await db.getConnection();

        // Check UNITs
        console.log('--- TABLE_UNIT (All) ---');
        const [units] = await conn.execute('SELECT * FROM TABLE_UNIT');
        console.table(units);

        // Get Latest VNO
        const [latest] = await conn.execute('SELECT VNO FROM TREATMENT1 ORDER BY RDATE DESC, VNO DESC LIMIT 1');
        const vno = latest[0]?.VNO;
        console.log('Latest VNO:', vno);

        if (vno) {
            // Try Insert with 'TIMES'
            console.log(`Attempting INSERT with VNO=${vno}, UNIT='TIMES'`);
            try {
                await conn.execute(`
                    INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
                    VALUES (?, 'MP002', 1, 'TIMES', 0, 0)
                `, [vno]);
                console.log('✅ INSERT with TIMES Success');
                // Cleanup
                await conn.execute('DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ? AND MEDICAL_PROCEDURE_CODE = ?', [vno, 'MP002']);
            } catch (e) {
                console.log('❌ INSERT with TIMES Failed:', e.code, e.sqlMessage);
            }

            // Try Insert with 'ครั้ง'
            console.log(`Attempting INSERT with VNO=${vno}, UNIT='ครั้ง'`);
            try {
                await conn.execute(`
                    INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
                    VALUES (?, 'MP002', 1, 'ครั้ง', 0, 0)
                `, [vno]);
                console.log('✅ INSERT with ครั้ง Success');
                // Cleanup
                await conn.execute('DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ? AND MEDICAL_PROCEDURE_CODE = ?', [vno, 'MP002']);
            } catch (e) {
                console.log('❌ INSERT with ครั้ง Failed:', e.code, e.sqlMessage);
            }
        }

        conn.release();
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

test();
