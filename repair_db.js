const mysql = require('mysql2/promise');
require('dotenv').config();

async function repairDatabase() {
    let connection;
    try {
        const dbModule = require('./config/db');
        let pool = dbModule.getConnection ? dbModule : (dbModule.then ? await dbModule : await dbModule);
        connection = await pool.getConnection();

        console.log('🚀 Starting Database Repair...');

        // 1. Remove Duplicates in TREATMENT1
        console.log('\n🔍 Step 1: Removing duplicate VNOs...');

        const [dupes] = await connection.query(`
        SELECT VNO, COUNT(*) as count 
        FROM TREATMENT1 
        GROUP BY VNO 
        HAVING count > 1
    `);

        if (dupes.length > 0) {
            console.log(`⚠️ Found ${dupes.length} sets of duplicates.`);

            for (const dupe of dupes) {
                const vno = dupe.VNO;
                console.log(`Processing duplicate VNO: ${vno}`);

                // Find rows for this VNO
                // We want to keep the one with the most data or the latest one
                // Since we don't have an ID, we'll use other fields to distinguish if possible, 
                // or just keep one arbitrarily.
                // Let's use SYSTEM_TIME or RDATE to sort.

                const [rows] = await connection.query(`
                SELECT * FROM TREATMENT1 WHERE VNO = ?
            `, [vno]);

                // Simple strategy: Keep the first one, delete the rest.
                // In a real scenario, we might merge data, but here likely they are identical or race-condition copies.
                // To delete specific rows without a PK is hard. LIMIT 1 doesn't guarantee which one.
                // But we can use the fact that we will keep ONE.

                // Delete ALL rows for this VNO
                await connection.query('DELETE FROM TREATMENT1 WHERE VNO = ?', [vno]);

                // Re-insert the BEST row (the first one found)
                const rowToKeep = rows[0];
                // Get columns to insert
                const columns = Object.keys(rowToKeep);
                const values = Object.values(rowToKeep);
                const placeholders = columns.map(() => '?').join(', ');

                await connection.query(`
                INSERT INTO TREATMENT1 (${columns.join(', ')}) VALUES (${placeholders})
            `, values);

                console.log(`✅ Fixed duplicates for ${vno} (kept 1 record)`);
            }
        } else {
            console.log('✅ No duplicates found.');
        }

        // 2. Add Primary Key to TREATMENT1
        console.log('\n🔧 Step 2: Adding PRIMARY KEY to TREATMENT1...');
        try {
            await connection.query('ALTER TABLE TREATMENT1 ADD PRIMARY KEY (VNO)');
            console.log('✅ PRIMARY KEY (VNO) added to TREATMENT1');
        } catch (e) {
            if (e.code === 'ER_MULTIPLE_PRI_KEY') {
                console.log('ℹ️ Primary Key already exists.');
            } else {
                console.error('❌ Failed to add Primary Key:', e.message);
            }
        }

        // 3. Add Foreign Keys (Example for TREATMENT1 -> patient1)
        console.log('\n🔗 Step 3: Adding Foreign Keys...');

        // Check missing FKs (simplified for now, just try to add if not exists would be complex logic in SQL)
        // We will attempt to add them. If index exists but constraint doesn't, this usually works or fails gracefully.

        // HNNO -> patient1.HNCODE
        try {
            // Ensure index exists first (MySQL usually requires index for FK)
            // await connection.query('CREATE INDEX idx_treatment1_hnno ON TREATMENT1(HNNO)'); 
            // Note: Usually index is created automatically with FK.

            await connection.query(`
            ALTER TABLE TREATMENT1 
            ADD CONSTRAINT fk_treatment1_patient 
            FOREIGN KEY (HNNO) REFERENCES patient1(HNCODE)
            ON UPDATE CASCADE ON DELETE RESTRICT
        `);
            console.log('✅ Added FK: TREATMENT1.HNNO -> patient1.HNCODE');
        } catch (e) {
            if (e.code === 'ER_FK_DUP_NAME' || e.message.includes('Foreign key constraint is incorrectly formed')) {
                console.log(`ℹ️ FK for HNNO may already exist or data mismatch: ${e.message}`);
                // If data mismatch (e.g. orphans), we should clean them.
                if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.errno === 1452) {
                    console.log('⚠️ Orphaned records found in TREATMENT1.HNNO. Cleaning up...');
                    await connection.query(`
                    DELETE t FROM TREATMENT1 t 
                    LEFT JOIN patient1 p ON t.HNNO = p.HNCODE 
                    WHERE p.HNCODE IS NULL
                 `);
                    console.log('🗑️ Orphaned records deleted. Retrying FK...');
                    await connection.query(`
                    ALTER TABLE TREATMENT1 
                    ADD CONSTRAINT fk_treatment1_patient 
                    FOREIGN KEY (HNNO) REFERENCES patient1(HNCODE)
                    ON UPDATE CASCADE ON DELETE RESTRICT
                `);
                    console.log('✅ Added FK: TREATMENT1.HNNO -> patient1.HNCODE (after cleanup)');
                }
            } else {
                console.log(`⚠️ Skiping FK HNNO: ${e.message}`);
            }
        }

        // Add other FKs as needed based on previous analysis
        // ...

        console.log('\n🏁 Database repair completed.');

    } catch (error) {
        console.error('🚨 Critical Error in Repair:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

repairDatabase();
