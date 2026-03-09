// test_psychotropic_route.js — run: node test_psychotropic_route.js
const mysql = require('mysql2/promise');

async function test() {
    const connection = await mysql.createConnection({
        host: 'goodappdev.com',
        user: 'goodappd_clinic',
        password: '0850789392',
        database: 'goodapp_clinic',
        port: 3306
    });

    console.log('✅ Connected\n');

    // 1. Check TABLE_DRUG columns
    console.log('=== TABLE_DRUG columns ===');
    const [cols] = await connection.execute(`SHOW COLUMNS FROM TABLE_DRUG`);
    const colNames = cols.map(c => c.Field);
    console.log(colNames.join(', '));

    // 2. Check Type1 values
    console.log('\n=== Type1 values in TABLE_DRUG ===');
    const [types] = await connection.execute(`SELECT DISTINCT Type1 FROM TABLE_DRUG WHERE Type1 IS NOT NULL LIMIT 20`);
    types.forEach(t => console.log(' -', JSON.stringify(t.Type1)));

    // 3. TREATMENT1_DRUG columns
    console.log('\n=== TREATMENT1_DRUG columns ===');
    const [dcols] = await connection.execute(`SHOW COLUMNS FROM TREATMENT1_DRUG`);
    console.log(dcols.map(c => c.Field).join(', '));

    // 4. Test the main query
    console.log('\n=== Test main query ===');
    try {
        const [rows] = await connection.execute(`
            SELECT
                p.HNCODE AS HN,
                td.DRUG_CODE,
                td.GENERIC_NAME,
                tdu.QTY,
                tdu.UNIT_CODE,
                tdu.UNIT_PRICE,
                tdu.AMT,
                t1.VNO,
                t1.RDATE,
                t1.EMP_CODE
            FROM TREATMENT1_DRUG tdu
            JOIN TABLE_DRUG td ON tdu.DRUG_CODE = td.DRUG_CODE
            JOIN TREATMENT1 t1 ON tdu.VNO = t1.VNO
            JOIN patient1 p ON t1.HNNO = p.HNCODE
            WHERE (td.Type1 = 'วัตถุออกฤทธิ์' OR td.Type1 = 'TD004')
            AND DATE(t1.RDATE) >= '2026-01-01'
            ORDER BY t1.RDATE DESC
            LIMIT 5
        `);
        console.log(`✅ Query OK — ${rows.length} rows`);
        if (rows.length > 0) console.log('Sample:', JSON.stringify(rows[0], null, 2));
    } catch (err) {
        console.error('❌ Query Error:', err.message);
    }

    // 5. Drug dropdown query
    console.log('\n=== Test drug list query ===');
    try {
        const [drugs] = await connection.execute(`
            SELECT DISTINCT DRUG_CODE, GENERIC_NAME, TRADE_NAME, Type1
            FROM TABLE_DRUG
            WHERE (Type1 = 'วัตถุออกฤทธิ์' OR Type1 = 'TD004')
            ORDER BY GENERIC_NAME
        `);
        console.log(`✅ Drug list OK — ${drugs.length} drugs`);
        drugs.forEach(d => console.log(` - ${d.DRUG_CODE} | ${d.GENERIC_NAME} | Type1: "${d.Type1}"`));
    } catch (err) {
        console.error('❌ Drug list Error:', err.message);
    }

    await connection.end();
}

test().catch(err => console.error('Fatal:', err.message));
