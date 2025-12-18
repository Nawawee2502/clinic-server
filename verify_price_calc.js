const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyPrice() {
    console.log('🧪 Verifying Price Calculation Logic...');
    const db = await mysql.createConnection({
        host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME
    });

    const vno = 'VN681218001';
    console.log(`Checking VNO: ${vno}`);

    let calculatedActualPrice = 100; // Base DF

    // 1. Fetch Drugs
    const [drugs] = await db.execute('SELECT DRUG_CODE, QTY FROM TREATMENT1_DRUG WHERE VNO = ?', [vno]);
    console.log(`Found ${drugs.length} drugs`);

    for (const drug of drugs) {
        const [info] = await db.execute('SELECT UNIT_PRICE FROM TABLE_DRUG WHERE DRUG_CODE = ?', [drug.DRUG_CODE]);
        const price = info[0]?.UNIT_PRICE ? parseFloat(info[0].UNIT_PRICE) : 0;
        console.log(`Drug ${drug.DRUG_CODE}: Price ${price} x Qty ${drug.QTY}`);
        calculatedActualPrice += (price * drug.QTY);
    }

    // 2. Fetch Procs
    const [procs] = await db.execute('SELECT MEDICAL_PROCEDURE_CODE, QTY FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?', [vno]);
    console.log(`Found ${procs.length} procedures`);

    for (const proc of procs) {
        const [info] = await db.execute('SELECT UNIT_PRICE FROM TABLE_MEDICAL_PROCEDURES WHERE MEDICAL_PROCEDURE_CODE = ?', [proc.MEDICAL_PROCEDURE_CODE]);
        const price = info[0]?.UNIT_PRICE ? parseFloat(info[0].UNIT_PRICE) : 0;
        console.log(`Proc ${proc.MEDICAL_PROCEDURE_CODE}: Price ${price} x Qty ${proc.QTY}`);
        calculatedActualPrice += (price * proc.QTY);
    }

    console.log('-----------------------------------');
    console.log(`💰 Expected ACTUAL_PRICE: ${calculatedActualPrice.toFixed(2)}`);

    await db.end();
}

verifyPrice();
