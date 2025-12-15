const mysql = require('mysql2/promise');
require('dotenv').config();

// Functions from treatment.js
function getThailandTime() {
    const now = new Date();
    const thailandTimeStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(now);
    const year = parseInt(thailandTimeStr.find(p => p.type === 'year').value);
    const month = parseInt(thailandTimeStr.find(p => p.type === 'month').value) - 1;
    const day = parseInt(thailandTimeStr.find(p => p.type === 'day').value);
    const hour = parseInt(thailandTimeStr.find(p => p.type === 'hour').value);
    const minute = parseInt(thailandTimeStr.find(p => p.type === 'minute').value);
    const second = parseInt(thailandTimeStr.find(p => p.type === 'second').value);
    const thailandDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    return new Date(thailandDateStr + '+07:00');
}
function formatDateForDB(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function formatTimeForDB(date) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}
const toNull = (value) => (value === undefined || value === '') ? null : value;

async function testInsert() {
    let connection;
    try {
        const dbModule = require('./config/db');
        let pool = dbModule.getConnection ? dbModule : (dbModule.then ? await dbModule : await dbModule);
        connection = await pool.getConnection();

        // Simulate logic
        await connection.query('SET FOREIGN_KEY_CHECKS=0');

        const thailandTime = getThailandTime();
        const thailandDate = formatDateForDB(thailandTime);
        const buddhistYear = (thailandTime.getFullYear() + 543).toString().slice(-2);
        const month = String(thailandTime.getMonth() + 1).padStart(2, '0');
        const day = String(thailandTime.getDate()).padStart(2, '0');

        // Generate VNO
        const vnPattern = `VN${buddhistYear}${month}${day}%`;
        const [vnMaxResult] = await connection.execute(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(VNO, 9, 3) AS UNSIGNED)), 0) as max_number
            FROM TREATMENT1 
            WHERE VNO LIKE ?
        `, [vnPattern]);
        const maxNumber = vnMaxResult[0]?.max_number || 0;
        const VNO = `VN${buddhistYear}${month}${day}${String(maxNumber + 1).padStart(3, '0')}`;
        console.log('Generated VNO:', VNO);

        // Params
        const HNNO = 'HNTEST001';
        const RDATE = null;
        const TRDATE = null;
        const WEIGHT1 = null; const HIGHT1 = null; const BT1 = null; const BP1 = null; const BP2 = null;
        const RR1 = null; const PR1 = null; const SPO2 = null;
        const SYMPTOM = 'Auto Test';
        const DXCODE = null; const ICD10CODE = null; const TREATMENT1 = null;
        const APPOINTMENT_DATE = null; const APPOINTMENT_TDATE = null;
        const EMP_CODE = 'DOC001'; const EMP_CODE1 = null;
        const STATUS1 = 'ทำงานอยู่';
        const QUEUE_ID = null; const INVESTIGATION_NOTES = null;
        const socialCard = 'N'; const ucsCard = 'N';

        await connection.execute(`
            INSERT INTO TREATMENT1 (
                VNO, HNNO, RDATE, TRDATE, WEIGHT1, HIGHT1, BT1, BP1, BP2, 
                RR1, PR1, SPO2, SYMPTOM, DXCODE, ICD10CODE, TREATMENT1,
                APPOINTMENT_DATE, APPOINTMENT_TDATE, EMP_CODE, EMP_CODE1,
                SYSTEM_DATE, SYSTEM_TIME, STATUS1, QUEUE_ID, INVESTIGATION_NOTES,
                SOCIAL_CARD, UCS_CARD
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            VNO, toNull(HNNO), toNull(RDATE) || thailandDate, toNull(TRDATE),
            toNull(WEIGHT1), toNull(HIGHT1), toNull(BT1), toNull(BP1), toNull(BP2),
            toNull(RR1), toNull(PR1), toNull(SPO2), toNull(SYMPTOM),
            toNull(DXCODE), toNull(ICD10CODE), toNull(TREATMENT1),
            toNull(APPOINTMENT_DATE), toNull(APPOINTMENT_TDATE),
            toNull(EMP_CODE), toNull(EMP_CODE1),
            formatDateForDB(thailandTime), formatTimeForDB(thailandTime),
            toNull(STATUS1), toNull(QUEUE_ID), toNull(INVESTIGATION_NOTES),
            socialCard, ucsCard
        ]);

        console.log('✅ Insert Success!');

        // Clean up
        await connection.execute('DELETE FROM TREATMENT1 WHERE VNO = ?', [VNO]);

    } catch (error) {
        console.error('❌ Insert Error:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

testInsert();
