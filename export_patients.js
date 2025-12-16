const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function exportData() {
    let connection;
    try {
        const dbModule = require('./config/db');
        let pool = dbModule.getConnection ? dbModule : (dbModule.then ? await dbModule : await dbModule);
        connection = await pool.getConnection();

        console.log('Fetching data for 2025-12-15...');

        // Select logic: Check RDATE or SYSTEM_DATE
        // Using RDATE as it is typically the 'Visit Date'
        const dateTarget = '2025-12-15';

        const [rows] = await connection.query(`
            SELECT 
                t.VNO, 
                t.HNNO, 
                CONCAT(p.PRENAME, p.NAME1, ' ', p.SURNAME) as PATIENT_NAME,
                t.RDATE, 
                t.SYMPTOM, 
                t.TREATMENT1 as TREATMENT_DETAIL,
                t.DXCODE,
                t.TOTAL_AMOUNT,
                t.PAYMENT_STATUS
            FROM TREATMENT1 t
            LEFT JOIN patient1 p ON t.HNNO = p.HNCODE
            WHERE t.RDATE = ? OR DATE(t.SYSTEM_DATE) = ?
        `, [dateTarget, dateTarget]);

        if (rows.length === 0) {
            console.log('No records found for this date.');
            return;
        }

        console.log(`Found ${rows.length} records.`);

        // Convert to CSV
        const headers = Object.keys(rows[0]).join(',');
        const csvRows = rows.map(row => {
            return Object.values(row).map(val => {
                if (val === null) return '';
                // Escape quotes and wrap in quotes if contains comma
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            }).join(',');
        });

        const csvContent = [headers, ...csvRows].join('\n');

        // Add BOM for Excel to read UTF-8 correctly
        const BOM = '\uFEFF';
        const filePath = path.join(__dirname, `export_patients_${dateTarget}.csv`);

        fs.writeFileSync(filePath, BOM + csvContent, 'utf8');
        console.log(`✅ Exported to: ${filePath}`);

    } catch (error) {
        console.error('Export failed:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

exportData();
