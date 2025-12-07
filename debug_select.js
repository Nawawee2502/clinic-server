const db = require('./config/db');

async function test() {
    try {
        const conn = await db.getConnection();

        // Find a VNO which actually has duplicates/lots of rows
        console.log('--- FINDING VNO WITH MANY DRUGS ---');
        const [rows] = await conn.execute(`
            SELECT VNO, COUNT(*) as c 
            FROM TREATMENT1_DRUG 
            GROUP BY VNO 
            HAVING c > 1 
            ORDER BY c DESC 
            LIMIT 1
        `);

        if (rows.length === 0) {
            console.log('No existing treatments with multiple drugs found.');
            // Try check table_drug type join directly
            const [drugs] = await conn.execute(`SELECT * FROM TABLE_DRUG LIMIT 1`);
            if (drugs.length > 0) {
                const d = drugs[0];
                console.log(`Checking Drug: ${d.DRUG_CODE}, Type1: ${d.Type1}`);
                const [types] = await conn.execute(`
                    SELECT * FROM TYPE_DRUG 
                    WHERE TYPE_DRUG_CODE = ? OR TYPE_DRUG_NAME = ?`, [d.Type1, d.Type1]);
                console.log(`Matches in TYPE_DRUG: ${types.length}`);
                console.table(types);
            }
        } else {
            const vno = rows[0].VNO;
            console.log(`Found VNO: ${vno} with ${rows[0].c} drug rows.`);

            const [drugs] = await conn.execute(`
            SELECT 
                td.VNO,
                td.DRUG_CODE,
                COALESCE(tdg.TYPE_DRUG_NAME, d.Type1, '') as TYPE_DRUG_NAME
            FROM TREATMENT1_DRUG td
            LEFT JOIN TABLE_DRUG d ON td.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TYPE_DRUG tdg 
                ON d.Type1 = tdg.TYPE_DRUG_CODE OR d.Type1 = tdg.TYPE_DRUG_NAME
            WHERE td.VNO = ?
            ORDER BY td.DRUG_CODE
            LIMIT 20
            `, [vno]);
            console.table(drugs);
        }

        conn.release();
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

test();
