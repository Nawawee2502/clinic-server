const mysql = require('mysql2/promise');
require('dotenv').config();

async function recalculatePrices() {
    console.log('🔄 Recalculating ACTUAL_PRICE for pending UCS treatments...');

    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        // Find pending UCS treatments
        const [treatments] = await db.execute(`
            SELECT t.VNO, t.ACTUAL_PRICE 
            FROM TREATMENT1 t 
            LEFT JOIN patient1 p ON t.HNNO = p.HNCODE
            WHERE p.UCS_CARD = 'Y' 
            AND (t.UCS_STATUS IS NULL OR t.UCS_STATUS != 'paid')
            ORDER BY t.VNO DESC
        `);

        console.log(`Found ${treatments.length} pending treatments.`);

        for (const t of treatments) {
            const vno = t.VNO;
            let calculatedActualPrice = 100; // Base DF

            // 1. Fetch Drugs
            const [drugs] = await db.execute('SELECT DRUG_CODE, QTY FROM TREATMENT1_DRUG WHERE VNO = ?', [vno]);
            for (const drug of drugs) {
                const drugCode = drug.DRUG_CODE;
                if (drugCode) {
                    const [info] = await db.execute('SELECT UNIT_PRICE FROM TABLE_DRUG WHERE DRUG_CODE = ?', [drugCode]);
                    const price = info[0]?.UNIT_PRICE ? parseFloat(info[0].UNIT_PRICE) : 0;
                    calculatedActualPrice += (price * (parseFloat(drug.QTY) || 1));
                }
            }

            // 2. Fetch Procs
            const [procs] = await db.execute('SELECT MEDICAL_PROCEDURE_CODE, QTY FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?', [vno]);
            for (const proc of procs) {
                const procCode = proc.MEDICAL_PROCEDURE_CODE;
                if (procCode) {
                    const [info] = await db.execute('SELECT UNIT_PRICE FROM TABLE_MEDICAL_PROCEDURES WHERE MEDICAL_PROCEDURE_CODE = ?', [procCode]);
                    const price = info[0]?.UNIT_PRICE ? parseFloat(info[0].UNIT_PRICE) : 0;
                    calculatedActualPrice += (price * (parseFloat(proc.QTY) || 1));
                }
            }

            // 3. Labs (Simplified for script)
            const [labs] = await db.execute('SELECT LABCODE FROM TREATMENT1_LABORATORY WHERE VNO = ?', [vno]);
            for (const lab of labs) {
                const [info] = await db.execute('SELECT PRICE FROM TABLE_LAB WHERE LABCODE = ?', [lab.LABCODE]);
                calculatedActualPrice += info[0]?.PRICE ? parseFloat(info[0].PRICE) : 100;
            }

            // 4. Radios
            const [radios] = await db.execute('SELECT RLCODE FROM TREATMENT1_RADIOLOGICAL WHERE VNO = ?', [vno]);
            for (const radio of radios) {
                const [info] = await db.execute('SELECT PRICE FROM TABLE_RADIOLOGICAL WHERE RLCODE = ?', [radio.RLCODE]);
                calculatedActualPrice += info[0]?.PRICE ? parseFloat(info[0].PRICE) : 200;
            }

            // Update if different
            if (Math.abs(calculatedActualPrice - parseFloat(t.ACTUAL_PRICE || 0)) > 0.01) {
                console.log(`📝 updating ${vno}: ${t.ACTUAL_PRICE} -> ${calculatedActualPrice}`);
                await db.execute('UPDATE TREATMENT1 SET ACTUAL_PRICE = ? WHERE VNO = ?', [calculatedActualPrice, vno]);
            } else {
                console.log(`✅ ${vno} is correct (${calculatedActualPrice})`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await db.end();
        console.log('👋 Done');
    }
}

recalculatePrices();
