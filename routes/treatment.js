const express = require('express');
const router = express.Router();

// ✅ Function to get Thailand time (UTC+7) - แก้ไขให้ใช้เวลาไทยอย่างถูกต้อง
function getThailandTime() {
    const now = new Date();
    // ✅ ใช้ Intl.DateTimeFormat เพื่อดึงเวลาไทยโดยตรง
    const thailandTimeStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(now);

    // ✅ สร้าง Date object จากเวลาไทย
    const year = parseInt(thailandTimeStr.find(p => p.type === 'year').value);
    const month = parseInt(thailandTimeStr.find(p => p.type === 'month').value) - 1; // month is 0-indexed
    const day = parseInt(thailandTimeStr.find(p => p.type === 'day').value);
    const hour = parseInt(thailandTimeStr.find(p => p.type === 'hour').value);
    const minute = parseInt(thailandTimeStr.find(p => p.type === 'minute').value);
    const second = parseInt(thailandTimeStr.find(p => p.type === 'second').value);

    // ✅ สร้าง Date object โดยใช้เวลาไทย
    const thailandDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    return new Date(thailandDateStr + '+07:00'); // ✅ ระบุ timezone เป็น +07:00
}

// ✅ Function to format date for database (YYYY-MM-DD) - ใช้เวลาไทย
function formatDateForDB(date) {
    // ✅ ใช้ Intl.DateTimeFormat เพื่อดึงวันที่จากเวลาไทย
    const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);

    return dateStr; // ✅ ได้รูปแบบ YYYY-MM-DD จากเวลาไทย
}

// ✅ Function to format time for database (HH:MM:SS) - ใช้เวลาไทย
function formatTimeForDB(date) {
    // ✅ ใช้ Intl.DateTimeFormat เพื่อดึงเวลาจากเวลาไทย
    const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);

    return timeStr; // ✅ ได้รูปแบบ HH:MM:SS จากเวลาไทย
}

// ✅ ตรวจสอบและสร้างหัตถการถ้ายังไม่มี - แก้เป็น async เพื่อให้ await ทำงานได้
const ensureProcedureExists = async (connection, procedureCode, procedureName) => {
    try {
        let code = (procedureCode || '').toString().trim();
        let name = (procedureName || '').toString().trim();

        if (!code) {
            return;
        }

        if (code.length > 15) {
            code = code.substring(0, 15);
        }

        if (name.length > 255) {
            name = name.substring(0, 255);
        }

        // ✅ ใช้ INSERT IGNORE และ await เพื่อให้รอให้เสร็จก่อน
        await connection.execute(`
            INSERT IGNORE INTO TABLE_MEDICAL_PROCEDURES 
            (MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE) 
            VALUES (?, ?, ?, 'Custom', 0)
        `, [
            code,
            name || 'หัตถการที่ไม่ระบุชื่อ',
            name || 'Unnamed Procedure'
        ]).catch((err) => {
            console.warn(`⚠️ ensureProcedureExists failed for ${code}:`, err.message);
        });
    } catch (error) {
        console.error(`❌ Error in ensureProcedureExists for ${procedureCode}:`, error);
    }
};

// ✅ ตรวจสอบและสร้างยาถ้ายังไม่มี - แก้เป็น async เพื่อให้ await ทำงานได้
const ensureDrugExists = async (connection, drugCode, drugName = null) => {
    try {
        const code = (drugCode || '').toString().trim();

        if (!code) {
            return;
        }

        // ✅ ใช้ INSERT IGNORE และ await เพื่อให้รอให้เสร็จก่อน
        const genericName = drugName || `ยา ${code}`;
        await connection.execute(`
            INSERT IGNORE INTO TABLE_DRUG 
            (DRUG_CODE, GENERIC_NAME, TRADE_NAME, UNIT_CODE, UNIT_PRICE, SOCIAL_CARD, UCS_CARD) 
            VALUES (?, ?, ?, 'TAB', 0, 'N', 'N')
        `, [
            code,
            genericName.substring(0, 255),
            genericName.substring(0, 255)
        ]).catch(() => {
            // Ignore errors
        });
    } catch (error) {
        // Ignore errors
    }
};

// ✅ ตรวจสอบและสร้างหน่วยถ้ายังไม่มี
const ensureUnitExists = async (connection, unitCode, unitName = 'ครั้ง') => {
    try {
        const code = (unitCode || '').toString().trim();

        if (!code) {
            return 'TAB'; // คืนค่า default
        }

        // ✅ ใช้ INSERT IGNORE เพื่อไม่ต้อง SELECT ก่อน (เร็วกว่า)
        // ถ้ามีอยู่แล้วจะไม่ insert, ถ้าไม่มีจะ insert
        try {
            await connection.execute(
                'INSERT IGNORE INTO TABLE_UNIT (UNIT_CODE, UNIT_NAME) VALUES (?, ?)',
                [code, unitName || 'ครั้ง']
            );
        } catch (insertError) {
            // ถ้า insert ไม่ได้ (อาจมี constraint อื่น) ให้ใช้ default
            console.warn(`⚠️ Could not insert unit ${code}, using default`);
            return 'TAB';
        }

        return code;
    } catch (error) {
        console.error('❌ Error ensuring unit exists:', error.message);
        return 'TAB'; // คืนค่า default
    }
};

// GET all treatments with filters
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const {
            page = 1, limit = 50, status, emp_code, hnno,
            date_from, date_to, dx_code, icd10_code, payment_status
        } = req.query;

        const limitInt = parseInt(limit);
        const pageInt = parseInt(page);
        const offset = (pageInt - 1) * limitInt;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (status) {
            whereClause += ' AND t.STATUS1 = ?';
            params.push(status);
        }
        if (emp_code) {
            whereClause += ' AND t.EMP_CODE = ?';
            params.push(emp_code);
        }
        if (hnno) {
            whereClause += ' AND t.HNNO = ?';
            params.push(hnno);
        }
        if (date_from) {
            whereClause += ' AND t.RDATE >= ?';
            params.push(date_from);
        }
        if (date_to) {
            whereClause += ' AND t.RDATE <= ?';
            params.push(date_to);
        }
        if (dx_code) {
            whereClause += ' AND t.DXCODE = ?';
            params.push(dx_code);
        }
        if (icd10_code) {
            whereClause += ' AND t.ICD10CODE = ?';
            params.push(icd10_code);
        }
        if (payment_status) {
            whereClause += ' AND t.PAYMENT_STATUS = ?';
            params.push(payment_status);
        }

        const [rows] = await db.execute(`
            SELECT 
                t.VNO, t.HNNO, t.RDATE, t.TRDATE, t.STATUS1,
                t.SYMPTOM, t.TREATMENT1, t.APPOINTMENT_DATE,
                t.TOTAL_AMOUNT, t.DISCOUNT_AMOUNT, t.NET_AMOUNT,
                t.PAYMENT_STATUS, t.PAYMENT_DATE, t.PAYMENT_TIME,
                t.PAYMENT_METHOD, t.RECEIVED_AMOUNT, t.CHANGE_AMOUNT, t.CASHIER,
                p.PRENAME, p.NAME1, p.SURNAME, p.AGE, p.SEX, p.TEL1,
                p.SOCIAL_CARD, p.UCS_CARD,
                e.EMP_NAME,
                dx.DXNAME_THAI, dx.DXNAME_ENG,
                icd.ICD10NAME_THAI
            FROM TREATMENT1 t
            LEFT JOIN patient1 p ON t.HNNO = p.HNCODE
            LEFT JOIN EMPLOYEE1 e ON t.EMP_CODE = e.EMP_CODE
            LEFT JOIN TABLE_DX dx ON t.DXCODE = dx.DXCODE
            LEFT JOIN TABLE_ICD10 icd ON t.ICD10CODE = icd.ICD10CODE
            ${whereClause}
            ORDER BY t.RDATE DESC, t.VNO DESC
            LIMIT ? OFFSET ?
        `, [...params, limitInt, offset]);

        const [countResult] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM TREATMENT1 t 
            ${whereClause}
        `, params);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: pageInt,
                limit: limitInt,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limitInt)
            }
        });
    } catch (error) {
        console.error('Error fetching treatments:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการรักษา',
            error: error.message
        });
    }
});

// ✅ GET Pending Gold Card Treatments (ต้องอยู่ก่อน route /:vno)
router.get('/ucs/pending', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { page = 1, limit = 50, date } = req.query;

        const limitInt = parseInt(limit);
        const pageInt = parseInt(page);
        const offset = (pageInt - 1) * limitInt;

        // ✅ ใช้ date จาก query string หรือใช้วันนี้ถ้าไม่ระบุ
        const filterDate = date || formatDateForDB(getThailandTime());

        // เงื่อนไข: สิทธิ์บัตรทอง (UCS_CARD='Y') และสถานะยังไม่ยืนยัน (UCS_STATUS != 'paid')
        // และเป็นวันที่ที่เลือก (RDATE = วันที่ที่เลือก)
        // ✅ ต้อง JOIN กับ patient1 เพื่อดึง UCS_CARD
        const whereClause = `
            WHERE p.UCS_CARD = 'Y' 
            AND (t.UCS_STATUS IS NULL OR t.UCS_STATUS != 'paid')
            AND t.STATUS1 = 'ปิดการรักษา'
            AND DATE(t.RDATE) = ?
        `;

        const [rows] = await db.execute(`
            SELECT 
                t.VNO, t.HNNO, t.RDATE, t.TRDATE,
                t.TOTAL_AMOUNT, t.DISCOUNT_AMOUNT, t.NET_AMOUNT,
                t.RECEIVED_AMOUNT, t.UCS_STATUS,
                p.PRENAME, p.NAME1, p.SURNAME, p.UCS_CARD
            FROM TREATMENT1 t
            LEFT JOIN patient1 p ON t.HNNO = p.HNCODE
            ${whereClause}
            ORDER BY t.RDATE DESC, t.VNO DESC
            LIMIT ? OFFSET ?
        `, [filterDate, limitInt, offset]);

        const [countResult] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM TREATMENT1 t
            LEFT JOIN patient1 p ON t.HNNO = p.HNCODE
            ${whereClause}
        `, [filterDate]);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: pageInt,
                limit: limitInt,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limitInt)
            }
        });
    } catch (error) {
        console.error('Error fetching pending UCS treatments:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยืนยันบัตรทอง',
            error: error.message
        });
    }
});

// ✅ PUT Confirm Gold Card Payment (ต้องอยู่ก่อน route /:vno)
router.put('/ucs/confirm/:vno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { vno } = req.params;
        const { amount } = req.body; // จำนวนเงินที่บันทึก (ถ้ามี)

        const [result] = await db.execute(`
            UPDATE TREATMENT1 
            SET UCS_STATUS = 'paid', 
                RECEIVED_AMOUNT = ?  -- อาจจะอัปเดตยอดรับเงินด้วยตาม requirement
            WHERE VNO = ?
        `, [amount || 0, vno]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการรักษา'
            });
        }

        res.json({
            success: true,
            message: 'ยืนยันการรับเงินจาก สปสช. สำเร็จ'
        });
    } catch (error) {
        console.error('Error confirming UCS payment:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการยืนยันรายการ',
            error: error.message
        });
    }
});

// GET treatment by VNO with full details
router.get('/:vno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { vno } = req.params;

        console.log(`Fetching treatment details for VNO: ${vno}`);

        const [treatment] = await db.execute(`
            SELECT 
                t.*,
                p.PRENAME, p.NAME1, p.SURNAME, p.AGE, p.SEX, p.IDNO, p.TEL1,
                p.BLOOD_GROUP1, p.ADDR1, p.DRUG_ALLERGY, p.FOOD_ALLERGIES,
                p.SOCIAL_CARD, p.UCS_CARD,
                e.EMP_NAME,
                er.EMP_NAME as RECORDER_NAME,
                dx.DXNAME_THAI, dx.DXNAME_ENG,
                icd.ICD10NAME_THAI, icd.ICD10NAME_ENG
            FROM TREATMENT1 t
            LEFT JOIN patient1 p ON t.HNNO = p.HNCODE
            LEFT JOIN EMPLOYEE1 e ON t.EMP_CODE = e.EMP_CODE
            LEFT JOIN EMPLOYEE1 er ON t.EMP_CODE1 = er.EMP_CODE
            LEFT JOIN TABLE_DX dx ON t.DXCODE = dx.DXCODE
            LEFT JOIN TABLE_ICD10 icd ON t.ICD10CODE = icd.ICD10CODE
            WHERE t.VNO = ?
        `, [vno]);

        if (treatment.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการรักษา'
            });
        }

        console.log(`Found treatment record for VNO: ${vno}`);

        const [diagnosis] = await db.execute(`
            SELECT * FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?
        `, [vno]);

        // ✅ Query โดยใช้ subquery เพื่อเลือก record แรกที่เจอของแต่ละ DRUG_CODE
        const [drugs] = await db.execute(`
            SELECT 
                td.VNO,
                td.DRUG_CODE,
                td.QTY,
                td.UNIT_CODE,
                td.UNIT_PRICE,
                td.AMT,
                td.NOTE1,
                td.TIME1,
                COALESCE(d.GENERIC_NAME, 'ยาไม่ระบุ') as GENERIC_NAME,
                COALESCE(d.TRADE_NAME, '') as TRADE_NAME,
                COALESCE(d.UNIT_PRICE, 0) as DRUG_UNIT_PRICE,
                COALESCE(d.eat1, '') as eat1,
                COALESCE(u.UNIT_NAME, td.UNIT_CODE) as UNIT_NAME,
                COALESCE((SELECT tdg.TYPE_DRUG_NAME FROM TYPE_DRUG tdg 
                    WHERE tdg.TYPE_DRUG_CODE = d.Type1 OR tdg.TYPE_DRUG_NAME = d.Type1 
                    LIMIT 1), d.Type1, '') as TYPE_DRUG_NAME,
                COALESCE(d.UCS_CARD, 'N') as UCS_CARD,
                COALESCE(d.Indication1, '') as Indication1
            FROM TREATMENT1_DRUG td
            INNER JOIN (
                SELECT DRUG_CODE, MIN(VNO) as MIN_VNO 
                FROM TREATMENT1_DRUG 
                WHERE VNO = ?
                GROUP BY DRUG_CODE
            ) first_drug ON td.DRUG_CODE = first_drug.DRUG_CODE AND td.VNO = first_drug.MIN_VNO
            LEFT JOIN TABLE_DRUG d ON td.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON td.UNIT_CODE = u.UNIT_CODE
            WHERE td.VNO = ?
            ORDER BY td.DRUG_CODE
        `, [vno, vno]);

        console.log(`✅ Found ${drugs.length} drugs for VNO: ${vno}`);
        if (drugs.length > 0) {
            console.log('📦 Sample drug data:', JSON.stringify(drugs[0], null, 2));
        }

        const [procedures] = await db.execute(`
            SELECT 
                tmp.VNO,
                tmp.MEDICAL_PROCEDURE_CODE,
                tmp.QTY,
                tmp.UNIT_CODE,
                tmp.UNIT_PRICE,
                tmp.AMT,
                COALESCE(mp.MED_PRO_NAME_THAI, 'หัตถการไม่ระบุ') as MED_PRO_NAME_THAI,
                COALESCE(mp.MED_PRO_NAME_ENG, '') as MED_PRO_NAME_ENG,
                COALESCE(mp.MED_PRO_TYPE, 'ทั่วไป') as MED_PRO_TYPE,
                COALESCE(u.UNIT_NAME, tmp.UNIT_CODE) as UNIT_NAME,
                tmp.MEDICAL_PROCEDURE_CODE as PROCEDURE_CODE,
                COALESCE(mp.MED_PRO_NAME_THAI, 'หัตถการไม่ระบุ') as PROCEDURE_NAME
            FROM TREATMENT1_MED_PROCEDURE tmp
            LEFT JOIN TABLE_MEDICAL_PROCEDURES mp ON tmp.MEDICAL_PROCEDURE_CODE = mp.MEDICAL_PROCEDURE_CODE
            LEFT JOIN TABLE_UNIT u ON tmp.UNIT_CODE = u.UNIT_CODE
            WHERE tmp.VNO = ?
            ORDER BY tmp.MEDICAL_PROCEDURE_CODE
        `, [vno]);

        console.log(`✅ Found ${procedures.length} procedures for VNO: ${vno}`);
        if (procedures.length > 0) {
            console.log('🔧 Sample procedure data:', JSON.stringify(procedures[0], null, 2));
        }

        const [labTests] = await db.execute(`
            SELECT 
                tl.VNO,
                tl.LABCODE,
                COALESCE(l.LABNAME, 'การตรวจไม่ระบุ') as LABNAME,
                100 as PRICE
            FROM TREATMENT1_LABORATORY tl
            LEFT JOIN TABLE_LAB l ON tl.LABCODE = l.LABCODE
            WHERE tl.VNO = ?
            ORDER BY l.LABNAME
        `, [vno]);

        console.log(`Found ${labTests.length} lab tests for VNO: ${vno}`);

        const [radioTests] = await db.execute(`
            SELECT 
                tr.VNO,
                tr.RLCODE,
                COALESCE(r.RLNAME, 'การตรวจไม่ระบุ') as RLNAME,
                200 as PRICE
            FROM TREATMENT1_RADIOLOGICAL tr
            LEFT JOIN TABLE_RADIOLOGICAL r ON tr.RLCODE = r.RLCODE
            WHERE tr.VNO = ?
            ORDER BY r.RLNAME
        `, [vno]);

        console.log(`Found ${radioTests.length} radiological tests for VNO: ${vno}`);

        const totalDrugCost = drugs.reduce((sum, drug) => sum + (parseFloat(drug.AMT) || 0), 0);
        const totalProcedureCost = procedures.reduce((sum, proc) => sum + (parseFloat(proc.AMT) || 0), 0);
        const totalLabCost = labTests.reduce((sum, lab) => sum + (parseFloat(lab.PRICE) || 0), 0);
        const totalRadioCost = radioTests.reduce((sum, radio) => sum + (parseFloat(radio.PRICE) || 0), 0);
        const totalCost = totalDrugCost + totalProcedureCost + totalLabCost + totalRadioCost;

        console.log(`💰 Calculated costs - Drugs: ${totalDrugCost}, Procedures: ${totalProcedureCost}, Total: ${totalCost}`);

        const responseData = {
            success: true,
            data: {
                treatment: treatment[0],
                diagnosis: diagnosis[0] || null,
                drugs: drugs || [],
                procedures: procedures || [],
                labTests: labTests || [],
                radiologicalTests: radioTests || [],
                summary: {
                    totalDrugCost: totalDrugCost,
                    totalProcedureCost: totalProcedureCost,
                    totalLabCost: totalLabCost,
                    totalRadioCost: totalRadioCost,
                    totalCost: totalCost,
                    drugCount: drugs.length,
                    procedureCount: procedures.length,
                    labTestCount: labTests.length,
                    radioTestCount: radioTests.length
                }
            }
        };

        console.log(`📤 Sending response for VNO ${vno}:`, {
            drugsCount: responseData.data.drugs.length,
            proceduresCount: responseData.data.procedures.length,
            labTestsCount: responseData.data.labTests.length,
            radioTestsCount: responseData.data.radiologicalTests.length
        });

        res.json(responseData);

    } catch (error) {
        console.error('Error fetching treatment details for VNO:', req.params.vno, error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดการรักษา',
            error: error.message,
            vno: req.params.vno
        });
    }
});

// ✅ GET Check UCS Usage Count for Current Month
router.get('/check-ucs-usage/:hn', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { hn } = req.params;

        // Get limits (hardcoded for now, or could come from config)
        const MAX_UCS_VISITS = 2;

        const thailandTime = getThailandTime();
        const year = thailandTime.getFullYear();
        const month = thailandTime.getMonth() + 1; // 1-indexed

        const [rows] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM TREATMENT1 
            WHERE HNNO = ? 
            AND UCS_CARD = 'Y'
            AND YEAR(RDATE) = ? 
            AND MONTH(RDATE) = ?
        `, [hn, year, month]);

        const usageCount = rows[0]?.count || 0;
        const remainingUsage = Math.max(0, MAX_UCS_VISITS - usageCount);
        const isExceeded = usageCount >= MAX_UCS_VISITS;

        res.json({
            success: true,
            data: {
                usageCount,
                maxUsage: MAX_UCS_VISITS,
                remainingUsage,
                isExceeded,
                year,
                month
            }
        });

    } catch (error) {
        console.error('Error checking UCS usage:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์บัตรทอง',
            error: error.message
        });
    }
});

// GET treatments by patient HN
router.get('/patient/:hn', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { hn } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const limitInt = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
        const pageInt = Math.max(1, parseInt(page, 10) || 1);
        const offset = (pageInt - 1) * limitInt;

        console.log(`Fetching treatments - HN: ${hn}, Page: ${pageInt}, Limit: ${limitInt}, Offset: ${offset}`);

        const [rows] = await db.execute(`
            SELECT 
                t.VNO, t.RDATE, t.TRDATE, t.STATUS1, t.SYMPTOM, t.TREATMENT1,
                e.EMP_NAME,
                dx.DXNAME_THAI,
                icd.ICD10NAME_THAI,
                p.SOCIAL_CARD, p.UCS_CARD
            FROM TREATMENT1 t
            LEFT JOIN EMPLOYEE1 e ON t.EMP_CODE = e.EMP_CODE
            LEFT JOIN TABLE_DX dx ON t.DXCODE = dx.DXCODE
            LEFT JOIN TABLE_ICD10 icd ON t.ICD10CODE = icd.ICD10CODE
            LEFT JOIN patient1 p ON t.HNNO = p.HNCODE
            WHERE t.HNNO = ?
            ORDER BY t.RDATE DESC, t.VNO DESC
            LIMIT ${limitInt} OFFSET ${offset}
        `, [hn]);

        const [countResult] = await db.execute(`
            SELECT COUNT(*) as total FROM TREATMENT1 WHERE HNNO = ?
        `, [hn]);

        console.log(`Found ${rows.length} treatments for patient ${hn}`);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: pageInt,
                limit: limitInt,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limitInt)
            }
        });
    } catch (error) {
        console.error('Error fetching treatments by patient:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการรักษาของผู้ป่วย',
            error: error.message
        });
    }
});

// POST create new treatment
router.post('/', async (req, res) => {
    const db = await require('../config/db');
    let connection = null;

    const toNull = (value) => value === undefined ? null : value;

    // Helper function to safely parse numeric values (including 0)
    const parseNumeric = (value) => {
        const nullValue = toNull(value);
        if (nullValue === null) {
            return null;
        }
        const parsed = parseFloat(nullValue);
        return isNaN(parsed) ? null : parsed;
    };

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        // ✅ Disable FK checks to bypass missing indexes on parent tables
        await connection.query('SET FOREIGN_KEY_CHECKS=0');

        const {
            HNNO, RDATE, TRDATE, WEIGHT1, HIGHT1, BT1, BP1, BP2,
            RR1, PR1, SPO2, SYMPTOM, DXCODE, ICD10CODE, TREATMENT1,
            APPOINTMENT_DATE, APPOINTMENT_TDATE, EMP_CODE, EMP_CODE1,
            STATUS1 = 'ทำงานอยู่',
            QUEUE_ID,
            diagnosis,
            drugs = [],
            procedures = [],
            labTests = [],
            radioTests = [],
            INVESTIGATION_NOTES
        } = req.body;

        console.log('📥 POST /treatments - Received data:', {
            HNNO,
            drugsCount: Array.isArray(drugs) ? drugs.length : 0,
            proceduresCount: Array.isArray(procedures) ? procedures.length : 0,
            drugs: Array.isArray(drugs) ? drugs : [],
            procedures: Array.isArray(procedures) ? procedures : []
        });

        if (!HNNO || !EMP_CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Hospital Number และรหัสแพทย์'
            });
        }

        // ✅ ใช้เวลาไทยแทน new Date()
        const thailandTime = getThailandTime();
        const thailandDate = formatDateForDB(thailandTime);
        const buddhistYear = (thailandTime.getFullYear() + 543).toString().slice(-2);
        const month = String(thailandTime.getMonth() + 1).padStart(2, '0');
        const day = String(thailandTime.getDate()).padStart(2, '0');

        // ✅ ใช้เวลาไทยแทน CURDATE()
        const [vnCount] = await connection.execute(`
            SELECT COUNT(*) + 1 as next_number
            FROM TREATMENT1 
            WHERE VNO LIKE ? AND DATE(SYSTEM_DATE) = ?
        `, [`VN${buddhistYear}${month}${day}%`, thailandDate]);

        const runningNumber = vnCount[0].next_number.toString().padStart(3, '0');
        const VNO = `VN${buddhistYear}${month}${day}${runningNumber}`;

        console.log(`🔢 Generated VNO: ${VNO} (Running: ${runningNumber})`);

        // ดึง SOCIAL_CARD และ UCS_CARD จาก DAILY_QUEUE
        let socialCard = null;
        let ucsCard = null;

        if (QUEUE_ID) {
            const [queueData] = await connection.execute(`
                SELECT SOCIAL_CARD, UCS_CARD FROM DAILY_QUEUE WHERE QUEUE_ID = ?
            `, [QUEUE_ID]);

            if (queueData.length > 0) {
                socialCard = queueData[0].SOCIAL_CARD;
                ucsCard = queueData[0].UCS_CARD;
                console.log(`📋 Retrieved from queue: SOCIAL_CARD=${socialCard}, UCS_CARD=${ucsCard}`);
            }
        }

        await connection.execute(`
            INSERT INTO TREATMENT1 (
                VNO, HNNO, RDATE, TRDATE, WEIGHT1, HIGHT1, BT1, BP1, BP2, 
                RR1, PR1, SPO2, SYMPTOM, DXCODE, ICD10CODE, TREATMENT1,
                APPOINTMENT_DATE, APPOINTMENT_TDATE, EMP_CODE, EMP_CODE1,
                SYSTEM_DATE, SYSTEM_TIME, STATUS1, QUEUE_ID, INVESTIGATION_NOTES,
                SOCIAL_CARD, UCS_CARD
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            VNO,
            toNull(HNNO),
            toNull(RDATE) || thailandDate, // ✅ ใช้เวลาไทยแทน today.toISOString()
            toNull(TRDATE),
            toNull(WEIGHT1), toNull(HIGHT1), toNull(BT1), toNull(BP1), toNull(BP2),
            toNull(RR1), toNull(PR1), toNull(SPO2), toNull(SYMPTOM),
            toNull(DXCODE), toNull(ICD10CODE), toNull(TREATMENT1),
            toNull(APPOINTMENT_DATE), toNull(APPOINTMENT_TDATE),
            toNull(EMP_CODE), toNull(EMP_CODE1),
            formatDateForDB(thailandTime), // ✅ ใช้เวลาไทยแทน CURDATE()
            formatTimeForDB(thailandTime), // ✅ ใช้เวลาไทยแทน CURTIME()
            toNull(STATUS1),
            toNull(QUEUE_ID), toNull(INVESTIGATION_NOTES),
            socialCard,
            ucsCard
        ]);

        if (diagnosis && (diagnosis.CHIEF_COMPLAINT || diagnosis.PRESENT_ILL || diagnosis.PHYSICAL_EXAM || diagnosis.PLAN1)) {
            await connection.execute(`
                INSERT INTO TREATMENT1_DIAGNOSIS (VNO, CHIEF_COMPLAINT, PRESENT_ILL, PHYSICAL_EXAM, PLAN1)
                VALUES (?, ?, ?, ?, ?)
            `, [VNO, diagnosis.CHIEF_COMPLAINT, diagnosis.PRESENT_ILL, diagnosis.PHYSICAL_EXAM, diagnosis.PLAN1]);
        }

        console.log(`💊 Processing ${drugs.length} drugs for VNO: ${VNO}`);
        let insertedDrugsCount = 0;
        for (const drug of drugs) {
            try {
                if (!drug.DRUG_CODE) {
                    console.warn('⚠️ Drug missing DRUG_CODE, skipping:', drug);
                    continue;
                }

                console.log(`💊 Processing drug: ${drug.DRUG_CODE}`, drug);

                // ✅ ตรวจสอบและสร้างยาถ้ายังไม่มี (รองรับระบบที่ไม่มี FK)
                const drugName = drug.GENERIC_NAME || drug.TRADE_NAME || drug.drugName;
                await ensureDrugExists(connection, drug.DRUG_CODE, drugName);

                // ✅ ตรวจสอบและสร้างหน่วยถ้ายังไม่มี
                let unitCode = drug.UNIT_CODE || 'TAB';
                unitCode = await ensureUnitExists(connection, unitCode, 'เม็ด');

                // Parse numeric values
                const qty = parseNumeric(drug.QTY);
                const unitPrice = parseNumeric(drug.UNIT_PRICE);
                const amt = parseNumeric(drug.AMT);

                // ✅ ใช้ INSERT IGNORE เพื่อรองรับกรณีที่ไม่มี FK constraints
                try {
                    await connection.execute(`
                        INSERT INTO TREATMENT1_DRUG (VNO, DRUG_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT, NOTE1, TIME1)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        VNO,
                        drug.DRUG_CODE,
                        qty !== null ? qty : 1,
                        unitCode,
                        unitPrice !== null ? unitPrice : 0,
                        amt !== null ? amt : 0,
                        drug.NOTE1 || '',
                        drug.TIME1 || ''
                    ]);

                    insertedDrugsCount++;
                    console.log(`✅ Successfully inserted drug: ${drug.DRUG_CODE}`);
                } catch (insertError) {
                    // ถ้าเป็น duplicate key error ให้ข้ามไป
                    if (insertError.code === 'ER_DUP_ENTRY') {
                        console.warn(`⚠️ Drug ${drug.DRUG_CODE} already exists for VNO ${VNO}, skipping`);
                        continue;
                    }
                    throw insertError; // Throw error อื่นๆ
                }
            } catch (drugError) {
                console.error(`❌ Error inserting drug ${drug.DRUG_CODE}:`, {
                    error: drugError.message,
                    code: drugError.code,
                    sqlState: drugError.sqlState,
                    drug: drug
                });
                // Continue with next drug instead of failing entire transaction
            }
        }
        console.log(`✅ Inserted ${insertedDrugsCount} out of ${drugs.length} drugs`);

        console.log(`🔧 Processing ${procedures.length} procedures for VNO: ${VNO}`);
        let insertedProceduresCount = 0;
        for (const proc of procedures) {
            try {
                const procedureCode = proc.MEDICAL_PROCEDURE_CODE || proc.PROCEDURE_CODE;
                if (!procedureCode) {
                    console.warn('⚠️ Procedure missing code, skipping:', proc);
                    continue;
                }

                console.log(`🔧 Processing procedure: ${procedureCode}`, proc);

                const procedureName = proc.PROCEDURE_NAME || proc.procedureName || 'หัตถการที่ไม่ระบุชื่อ';

                // ✅ ตรวจสอบและสร้างหัตถการถ้ายังไม่มี (รองรับระบบที่ไม่มี FK)
                await ensureProcedureExists(connection, procedureCode, procedureName);

                // ✅ ตรวจสอบและสร้างหน่วยถ้ายังไม่มี
                let unitCode = proc.UNIT_CODE || 'TIMES';
                unitCode = await ensureUnitExists(connection, unitCode, 'ครั้ง');

                // Parse numeric values
                const qty = parseNumeric(proc.QTY);
                const unitPrice = parseNumeric(proc.UNIT_PRICE);
                const amt = parseNumeric(proc.AMT);

                // ✅ ใช้ INSERT IGNORE เพื่อรองรับกรณีที่ไม่มี FK constraints
                try {
                    await connection.execute(`
                        INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        VNO,
                        procedureCode,
                        qty !== null ? qty : 1,
                        unitCode,
                        unitPrice !== null ? unitPrice : 0,
                        amt !== null ? amt : 0
                    ]);

                    insertedProceduresCount++;
                    console.log(`✅ Successfully inserted procedure: ${procedureCode}`);
                } catch (insertError) {
                    // ถ้าเป็น duplicate key error ให้ข้ามไป
                    if (insertError.code === 'ER_DUP_ENTRY') {
                        console.warn(`⚠️ Procedure ${procedureCode} already exists for VNO ${VNO}, skipping`);
                        continue;
                    }
                    throw insertError; // Throw error อื่นๆ
                }
            } catch (procError) {
                console.error(`❌ Error inserting procedure:`, {
                    error: procError.message,
                    code: procError.code,
                    sqlState: procError.sqlState,
                    procedure: proc
                });
                // Continue with next procedure instead of failing entire transaction
            }
        }
        console.log(`✅ Inserted ${insertedProceduresCount} out of ${procedures.length} procedures`);

        for (const lab of labTests) {
            if (lab.LABCODE) {
                await connection.execute(`
                    INSERT INTO TREATMENT1_LABORATORY (VNO, LABCODE) VALUES (?, ?)
                `, [VNO, lab.LABCODE]);
            }
        }

        for (const radio of radioTests) {
            if (radio.RLCODE) {
                await connection.execute(`
                    INSERT INTO TREATMENT1_RADIOLOGICAL (VNO, RLCODE) VALUES (?, ?)
                `, [VNO, radio.RLCODE]);
            }
        }

        // ✅ Restore FK checks before commit
        await connection.query('SET FOREIGN_KEY_CHECKS=1');
        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'บันทึกข้อมูลการรักษาสำเร็จ',
            data: { VNO, HNNO, STATUS1, QUEUE_ID }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }

        console.error('Error creating treatment:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'Visit Number นี้มีอยู่แล้ว'
            });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({
                success: false,
                message: 'ไม่พบข้อมูลอ้างอิง (ผู้ป่วย, แพทย์, รหัสยา หรือหัตถการ)'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการรักษา',
                error: error.message
            });
        }
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// PUT update entire treatment
router.put('/:vno', async (req, res) => {
    // ✅ Log ทันทีที่ request ถึง route (ก่อนทำอะไรเลย)
    const vno = req.params.vno;
    const startTime = Date.now();
    console.log(`🚀 [${vno}] ========== REQUEST RECEIVED: PUT /treatments/${vno} at ${new Date().toISOString()} ==========`);
    console.log(`📦 [${vno}] Request headers:`, {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
    });

    const db = await require('../config/db');
    let connection = null;

    const toNull = (value) => {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        return value;
    };

    // Helper function to safely parse numeric values (including 0)
    const parseNumeric = (value) => {
        const nullValue = toNull(value);
        if (nullValue === null) {
            return null;
        }
        const parsed = parseFloat(nullValue);
        return isNaN(parsed) ? null : parsed;
    };

    try {
        const connectionStart = Date.now();
        console.log(`🔗 [${vno}] Getting database connection... (elapsed: ${Date.now() - startTime}ms)`);
        connection = await db.getConnection();
        const connectionTime = Date.now() - connectionStart;
        console.log(`✅ [${vno}] Got connection in ${connectionTime}ms (total elapsed: ${Date.now() - startTime}ms)`);

        if (connectionTime > 1000) {
            console.warn(`⚠️ [${vno}] WARNING: Connection took ${connectionTime}ms (very slow!)`);
        }

        const transactionStart = Date.now();
        await connection.beginTransaction();
        // ✅ Disable FK checks to bypass missing indexes on parent tables
        await connection.query('SET FOREIGN_KEY_CHECKS=0');
        console.log(`✅ [${vno}] Transaction started in ${Date.now() - transactionStart}ms (total elapsed: ${Date.now() - startTime}ms)`);

        const {
            VNO, HNNO, DXCODE, ICD10CODE, TREATMENT1, STATUS1,
            SYMPTOM, diagnosis, drugs = [], procedures = [],
            labTests = [], radioTests = [], INVESTIGATION_NOTES,
            WEIGHT1, HIGHT1, BT1, PR1, RR1, BP1, BP2, SPO2,
            TOTAL_AMOUNT, DISCOUNT_AMOUNT, NET_AMOUNT,
            PAYMENT_STATUS, PAYMENT_DATE, PAYMENT_TIME,
            PAYMENT_METHOD, RECEIVED_AMOUNT, CHANGE_AMOUNT, CASHIER
        } = req.body;

        console.log(`📦 [${vno}] Request body:`, {
            drugsCount: Array.isArray(drugs) ? drugs.length : 0,
            proceduresCount: Array.isArray(procedures) ? procedures.length : 0,
            hasDrugs: req.body.hasOwnProperty('drugs'),
            hasProcedures: req.body.hasOwnProperty('procedures'),
            drugs: drugs,
            procedures: procedures
        });

        // ✅ แปลงเป็น array ให้แน่ใจ (รองรับกรณีที่ส่งมาเป็น object เดียวหรือ undefined)
        const drugsArray = Array.isArray(drugs) ? drugs : (drugs && typeof drugs === 'object' ? [drugs] : []);
        const proceduresArray = Array.isArray(procedures) ? procedures : (procedures && typeof procedures === 'object' ? [procedures] : []);

        console.log(`📦 [${vno}] Parsed arrays:`, {
            drugsArrayLength: drugsArray.length,
            proceduresArrayLength: proceduresArray.length,
            hasDrugsInRequest: req.body.hasOwnProperty('drugs'),
            hasProceduresInRequest: req.body.hasOwnProperty('procedures'),
            drugsArray: drugsArray,
            proceduresArray: proceduresArray
        });

        // ✅ ตรวจสอบว่า VNO มีใน TREATMENT1 หรือไม่
        const [checkVNO] = await connection.execute(
            `SELECT VNO FROM TREATMENT1 WHERE VNO = ?`, [vno]
        );

        if (checkVNO.length === 0) {
            await connection.rollback();
            console.error(`❌ [${vno}] VNO does not exist in TREATMENT1! Cannot insert drugs/procedures.`);
            return res.status(404).json({
                success: false,
                message: `ไม่พบ VNO ${vno} ในระบบ กรุณาสร้าง TREATMENT1 ก่อน`
            });
        }

        console.log(`✅ [${vno}] VNO exists in TREATMENT1, proceeding with update...`);

        console.log(`📝 [${vno}] Updating TREATMENT1...`);
        const [updateResult] = await connection.execute(`
            UPDATE TREATMENT1 SET 
                SYMPTOM = COALESCE(?, SYMPTOM), 
                STATUS1 = COALESCE(?, STATUS1),
                DXCODE = COALESCE(?, DXCODE),
                ICD10CODE = COALESCE(?, ICD10CODE),
                TREATMENT1 = COALESCE(?, TREATMENT1),
                INVESTIGATION_NOTES = COALESCE(?, INVESTIGATION_NOTES),
                WEIGHT1 = COALESCE(?, WEIGHT1),
                HIGHT1 = COALESCE(?, HIGHT1),
                BT1 = COALESCE(?, BT1),
                PR1 = COALESCE(?, PR1),
                RR1 = COALESCE(?, RR1),
                BP1 = COALESCE(?, BP1),
                BP2 = COALESCE(?, BP2),
                SPO2 = COALESCE(?, SPO2),
                TOTAL_AMOUNT = COALESCE(?, TOTAL_AMOUNT),
                TREATMENT_FEE = COALESCE(?, TREATMENT_FEE),
                DISCOUNT_AMOUNT = COALESCE(?, DISCOUNT_AMOUNT),
                NET_AMOUNT = COALESCE(?, NET_AMOUNT),
                PAYMENT_STATUS = COALESCE(?, PAYMENT_STATUS),
                PAYMENT_DATE = COALESCE(?, PAYMENT_DATE),
                PAYMENT_TIME = COALESCE(?, PAYMENT_TIME),
                PAYMENT_METHOD = COALESCE(?, PAYMENT_METHOD),
                RECEIVED_AMOUNT = COALESCE(?, RECEIVED_AMOUNT),
                CHANGE_AMOUNT = COALESCE(?, CHANGE_AMOUNT),
                CASHIER = COALESCE(?, CASHIER)
            WHERE VNO = ?
        `, [
            toNull(SYMPTOM),
            toNull(STATUS1),
            toNull(DXCODE),
            toNull(ICD10CODE),
            toNull(TREATMENT1),
            toNull(INVESTIGATION_NOTES),
            toNull(WEIGHT1),
            toNull(HIGHT1),
            toNull(BT1),
            toNull(PR1),
            toNull(RR1),
            toNull(BP1),
            toNull(BP2),
            toNull(SPO2),
            parseNumeric(TOTAL_AMOUNT),
            parseNumeric(req.body.TREATMENT_FEE), // ✅ ค่ารักษาแยก
            parseNumeric(DISCOUNT_AMOUNT),
            parseNumeric(NET_AMOUNT),
            toNull(PAYMENT_STATUS),
            toNull(PAYMENT_DATE),
            toNull(PAYMENT_TIME),
            toNull(PAYMENT_METHOD),
            parseNumeric(RECEIVED_AMOUNT),
            parseNumeric(CHANGE_AMOUNT),
            toNull(CASHIER),
            vno
        ]);

        console.log(`✅ [${vno}] TREATMENT1 updated, affectedRows: ${updateResult.affectedRows}`);
        if (updateResult.affectedRows === 0) {
            console.warn(`⚠️ [${vno}] TREATMENT1 update affected 0 rows (may be normal if no fields changed)`);
        }

        if (diagnosis && typeof diagnosis === 'object') {
            await connection.execute(`
                INSERT INTO TREATMENT1_DIAGNOSIS (VNO, CHIEF_COMPLAINT, PRESENT_ILL, PHYSICAL_EXAM, PLAN1)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                CHIEF_COMPLAINT = VALUES(CHIEF_COMPLAINT),
                PRESENT_ILL = VALUES(PRESENT_ILL),
                PHYSICAL_EXAM = VALUES(PHYSICAL_EXAM),
                PLAN1 = VALUES(PLAN1)
            `, [
                vno,
                toNull(diagnosis.CHIEF_COMPLAINT),
                toNull(diagnosis.PRESENT_ILL),
                toNull(diagnosis.PHYSICAL_EXAM),
                toNull(diagnosis.PLAN1)
            ]);
        }

        // ✅ บันทึกยา - แก้ไขให้ลบเฉพาะเมื่อมีการส่ง drugs มา
        console.log(`💊 [${vno}] ========== DRUGS PROCESSING START ==========`);
        console.log(`💊 [${vno}] Checking drugsArray:`, {
            exists: !!drugsArray,
            isArray: Array.isArray(drugsArray),
            length: drugsArray?.length || 0,
            data: JSON.stringify(drugsArray, null, 2)
        });

        // ✅ ตรวจสอบว่ามีการส่ง drugs มาใน request หรือไม่ (ไม่ใช่แค่ empty array)
        const hasDrugsInRequest = req.body.hasOwnProperty('drugs');

        if (hasDrugsInRequest) {
            // ✅ มีการส่ง drugs มาใน request - ให้ลบและบันทึกใหม่
            if (drugsArray && drugsArray.length > 0) {
                const drugsStart = Date.now();
                console.log(`💊 [${vno}] Processing ${drugsArray.length} drugs...`);
                console.log(`💊 [${vno}] Drugs data:`, JSON.stringify(drugsArray, null, 2));

                // ✅ DELETE existing drugs
                try {
                    const [deleteResult] = await connection.execute(`DELETE FROM TREATMENT1_DRUG WHERE VNO = ?`, [vno]);
                    console.log(`🗑️ [${vno}] Deleted ${deleteResult.affectedRows} existing drugs`);
                } catch (deleteError) {
                    console.error(`❌ [${vno}] DELETE drugs ERROR:`, {
                        message: deleteError.message,
                        code: deleteError.code,
                        sqlState: deleteError.sqlState
                    });
                    // ✅ ไม่ throw error เพื่อให้สามารถ insert ใหม่ได้
                }

                // ✅ Loop Insert ทีละตัว (Sequential Insert) เพื่อความชัวร์และตรวจสอบ Master Data
                let successCount = 0;
                for (let i = 0; i < drugsArray.length; i++) {
                    const drug = drugsArray[i];
                    const drugCode = toNull(drug.DRUG_CODE) || toNull(drug.drugCode) || toNull(drug.DRUGCODE);

                    if (!drugCode) {
                        console.warn(`⚠️ [${vno}] Drug ${i + 1} skipped: no DRUG_CODE`);
                        continue;
                    }

                    // ✅ ตรวจสอบ Master Data ก่อน Insert
                    const drugName = drug.GENERIC_NAME || drug.TRADE_NAME || drug.drugName;
                    console.log(`💊 [${vno}] Ensuring drug exists: ${drugCode} (${drugName})`);
                    await ensureDrugExists(connection, drugCode, drugName); // สร้างยาใน Master ถ้ายังไม่มี

                    let unitCode = toNull(drug.UNIT_CODE) || toNull(drug.unitCode) || toNull(drug.UNITCODE) || 'TAB';
                    unitCode = await ensureUnitExists(connection, unitCode, 'เม็ด'); // สร้างหน่วยนับถ้ายังไม่มี

                    // Parse numeric values
                    let qty = parseNumeric(drug.QTY) ?? parseNumeric(drug.qty);
                    if (qty === null || qty === undefined || qty <= 0) qty = 1;

                    let unitPrice = parseNumeric(drug.UNIT_PRICE) ?? parseNumeric(drug.unitPrice) ?? parseNumeric(drug.UNITPRICE);
                    if (unitPrice === null || unitPrice === undefined) unitPrice = 0;

                    let amt = parseNumeric(drug.AMT) ?? parseNumeric(drug.amt);
                    if (amt === null || amt === undefined || amt === 0) {
                        amt = qty * unitPrice;
                    }

                    console.log(`💊 [${vno}] Inserting drug: ${drugCode}, QTY=${qty}, UNIT_PRICE=${unitPrice}, AMT=${amt}, UNIT_CODE=${unitCode}`);
                    console.log(`💊 [${vno}] INSERT VALUES:`, {
                        VNO: vno,
                        DRUG_CODE: drugCode,
                        QTY: qty,
                        UNIT_CODE: unitCode,
                        UNIT_PRICE: unitPrice,
                        AMT: amt,
                        NOTE1: toNull(drug.NOTE1) || toNull(drug.note) || toNull(drug.NOTE) || '',
                        TIME1: toNull(drug.TIME1) || toNull(drug.time) || toNull(drug.TIME) || ''
                    });

                    try {
                        const [result] = await connection.execute(`
                        INSERT INTO TREATMENT1_DRUG (VNO, DRUG_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT, NOTE1, TIME1)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                            vno, drugCode, qty, unitCode, unitPrice, amt,
                            toNull(drug.NOTE1) || toNull(drug.note) || toNull(drug.NOTE) || '',
                            toNull(drug.TIME1) || toNull(drug.time) || toNull(drug.TIME) || ''
                        ]);
                        console.log(`✅ [${vno}] Drug ${drugCode} inserted successfully, affectedRows: ${result.affectedRows}, insertId: ${result.insertId}`);
                        successCount++;
                    } catch (insertError) {
                        console.error(`❌ [${vno}] INSERT drug ${drugCode} FAILED:`, {
                            message: insertError.message,
                            code: insertError.code,
                            sqlState: insertError.sqlState,
                            sqlMessage: insertError.sqlMessage,
                            errno: insertError.errno,
                            sql: `INSERT INTO TREATMENT1_DRUG (VNO, DRUG_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT, NOTE1, TIME1) VALUES ('${vno}', '${drugCode}', ${qty}, '${unitCode}', ${unitPrice}, ${amt}, '${toNull(drug.NOTE1) || ''}', '${toNull(drug.TIME1) || ''}')`
                        });
                        // ✅ ไม่ throw error เพื่อให้บันทึกยาตัวอื่นต่อได้ แต่ log error ไว้
                    }
                }
                console.log(`💊 [${vno}] Inserted ${successCount}/${drugsArray.length} drugs in ${Date.now() - drugsStart}ms`);
            } else {
                // ✅ ส่ง drugs มาแต่เป็น empty array - ให้ลบข้อมูลเดิมออก
                console.log(`💊 [${vno}] Empty drugs array received - deleting existing drugs`);
                try {
                    const [deleteResult] = await connection.execute(`DELETE FROM TREATMENT1_DRUG WHERE VNO = ?`, [vno]);
                    console.log(`🗑️ [${vno}] Deleted ${deleteResult.affectedRows} existing drugs (empty array)`);
                } catch (deleteError) {
                    console.error(`❌ [${vno}] DELETE drugs ERROR:`, deleteError.message);
                }
            }
        } else {
            console.log(`⚠️ [${vno}] No drugs field in request - keeping existing drugs`);
        }

        // ✅ บันทึกหัตถการ - แก้ไขให้ลบเฉพาะเมื่อมีการส่ง procedures มา
        console.log(`🔧 [${vno}] ========== PROCEDURES PROCESSING START ==========`);
        console.log(`🔧 [${vno}] Checking proceduresArray:`, {
            exists: !!proceduresArray,
            isArray: Array.isArray(proceduresArray),
            length: proceduresArray?.length || 0,
            data: JSON.stringify(proceduresArray, null, 2)
        });

        // ✅ ตรวจสอบว่ามีการส่ง procedures มาใน request หรือไม่ (ไม่ใช่แค่ empty array)
        const hasProceduresInRequest = req.body.hasOwnProperty('procedures');

        if (hasProceduresInRequest) {
            // ✅ มีการส่ง procedures มาใน request - ให้ลบและบันทึกใหม่
            if (proceduresArray && proceduresArray.length > 0) {
                const procStart = Date.now();
                console.log(`🔧 [${vno}] Processing ${proceduresArray.length} procedures...`);
                console.log(`🔧 [${vno}] Procedures data:`, JSON.stringify(proceduresArray, null, 2));

                // ✅ DELETE existing procedures
                try {
                    const [deleteResult] = await connection.execute(`DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?`, [vno]);
                    console.log(`🗑️ [${vno}] Deleted ${deleteResult.affectedRows} existing procedures`);
                } catch (deleteError) {
                    console.error(`❌ [${vno}] DELETE procedures ERROR:`, {
                        message: deleteError.message,
                        code: deleteError.code,
                        sqlState: deleteError.sqlState
                    });
                    // ✅ ไม่ throw error เพื่อให้สามารถ insert ใหม่ได้
                }

                let successCount = 0;
                for (let i = 0; i < proceduresArray.length; i++) {
                    const proc = proceduresArray[i];
                    let procedureCode = toNull(proc.PROCEDURE_CODE) || toNull(proc.MEDICAL_PROCEDURE_CODE) || toNull(proc.procedureCode) || toNull(proc.PROCEDURECODE) || toNull(proc.MEDICALPROCEDURECODE);

                    if (!procedureCode) {
                        console.warn(`⚠️ [${vno}] Procedure ${i + 1} skipped: no PROCEDURE_CODE`);
                        continue;
                    }

                    if (procedureCode.length > 15) {
                        procedureCode = procedureCode.substring(0, 15);
                    }

                    // ✅ ตรวจสอบ Master Data ก่อน Insert
                    const procedureName = proc.PROCEDURE_NAME || proc.procedureName || 'หัตถการไม่ระบุชื่อ';
                    console.log(`🔧 [${vno}] Ensuring procedure exists: ${procedureCode} (${procedureName})`);
                    await ensureProcedureExists(connection, procedureCode, procedureName); // สร้างหัตถการ Custom ใน Master

                    let unitCode = toNull(proc.UNIT_CODE) || toNull(proc.unitCode) || toNull(proc.UNITCODE);
                    // ❌ Removed forced conversion to 'TIMES' to support 'ครั้ง'
                    unitCode = await ensureUnitExists(connection, unitCode || 'ครั้ง', 'ครั้ง');

                    // Parse numeric values
                    let procQty = parseNumeric(proc.QTY) ?? parseNumeric(proc.qty);
                    if (procQty === null || procQty === undefined || procQty <= 0) procQty = 1;

                    let procUnitPrice = parseNumeric(proc.UNIT_PRICE) ?? parseNumeric(proc.unitPrice) ?? parseNumeric(proc.UNITPRICE);
                    if (procUnitPrice === null || procUnitPrice === undefined) procUnitPrice = 0;

                    let procAmt = parseNumeric(proc.AMT) ?? parseNumeric(proc.amt);
                    if (procAmt === null || procAmt === undefined || procAmt === 0) {
                        procAmt = procQty * procUnitPrice;
                    }

                    console.log(`🔧 [${vno}] Inserting procedure: ${procedureCode}, QTY=${procQty}, UNIT_PRICE=${procUnitPrice}, AMT=${procAmt}, UNIT_CODE=${unitCode}`);
                    console.log(`🔧 [${vno}] INSERT VALUES:`, {
                        VNO: vno,
                        MEDICAL_PROCEDURE_CODE: procedureCode,
                        QTY: procQty,
                        UNIT_CODE: unitCode,
                        UNIT_PRICE: procUnitPrice,
                        AMT: procAmt
                    });

                    try {
                        const [result] = await connection.execute(`
                        INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                            vno, procedureCode, procQty, unitCode, procUnitPrice, procAmt
                        ]);
                        console.log(`✅ [${vno}] Procedure ${procedureCode} inserted successfully, affectedRows: ${result.affectedRows}, insertId: ${result.insertId}`);
                        successCount++;
                    } catch (insertError) {
                        console.error(`❌ [${vno}] INSERT procedure ${procedureCode} FAILED:`, {
                            message: insertError.message,
                            code: insertError.code,
                            sqlState: insertError.sqlState,
                            sqlMessage: insertError.sqlMessage,
                            errno: insertError.errno,
                            sql: `INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT) VALUES ('${vno}', '${procedureCode}', ${procQty}, '${unitCode}', ${procUnitPrice}, ${procAmt})`
                        });
                        // ✅ ไม่ throw error เพื่อให้บันทึกหัตถการตัวอื่นต่อได้ แต่ log error ไว้
                    }
                }
                console.log(`🔧 [${vno}] Inserted ${successCount}/${proceduresArray.length} procedures in ${Date.now() - procStart}ms`);
            } else {
                // ✅ ส่ง procedures มาแต่เป็น empty array - ให้ลบข้อมูลเดิมออก
                console.log(`🔧 [${vno}] Empty procedures array received - deleting existing procedures`);
                try {
                    const [deleteResult] = await connection.execute(`DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?`, [vno]);
                    console.log(`🗑️ [${vno}] Deleted ${deleteResult.affectedRows} existing procedures (empty array)`);
                } catch (deleteError) {
                    console.error(`❌ [${vno}] DELETE procedures ERROR:`, deleteError.message);
                }
            }
        } else {
            console.log(`⚠️ [${vno}] No procedures field in request - keeping existing procedures`);
        }

        if (labTests && Array.isArray(labTests) && labTests.length > 0) {
            await connection.execute(`DELETE FROM TREATMENT1_LABORATORY WHERE VNO = ?`, [vno]);

            for (const lab of labTests) {
                if (lab.LABCODE) {
                    await connection.execute(`
                        INSERT INTO TREATMENT1_LABORATORY (VNO, LABCODE) VALUES (?, ?)
                    `, [vno, toNull(lab.LABCODE)]);
                }
            }
        }

        if (radioTests && Array.isArray(radioTests) && radioTests.length > 0) {
            await connection.execute(`DELETE FROM TREATMENT1_RADIOLOGICAL WHERE VNO = ?`, [vno]);

            for (const radio of radioTests) {
                if (radio.RLCODE) {
                    await connection.execute(`
                        INSERT INTO TREATMENT1_RADIOLOGICAL (VNO, RLCODE) VALUES (?, ?)
                    `, [vno, toNull(radio.RLCODE)]);
                }
            }
        }

        // ✅ ตรวจสอบว่ามีข้อมูลที่จะบันทึกหรือไม่
        const hasDataToSave = (drugsArray && drugsArray.length > 0) ||
            (proceduresArray && proceduresArray.length > 0) ||
            (labTests && Array.isArray(labTests) && labTests.length > 0) ||
            (radioTests && Array.isArray(radioTests) && radioTests.length > 0);

        console.log(`📊 [${vno}] Summary before commit:`, {
            hasDataToSave,
            drugsCount: drugsArray?.length || 0,
            proceduresCount: proceduresArray?.length || 0,
            labTestsCount: Array.isArray(labTests) ? labTests.length : 0,
            radioTestsCount: Array.isArray(radioTests) ? radioTests.length : 0
        });

        // ✅ Commit transaction ก่อนส่ง response
        const commitStart = Date.now();
        console.log(`💾 [${vno}] ========== COMMITTING TRANSACTION... (elapsed: ${Date.now() - startTime}ms) ==========`);

        // ✅ Restore FK checks before commit
        await connection.query('SET FOREIGN_KEY_CHECKS=1');
        await connection.commit();
        console.log(`💾 [${vno}] ✅ COMMIT DONE in ${Date.now() - commitStart}ms (total: ${Date.now() - startTime}ms)`);

        // ✅ ตรวจสอบว่าข้อมูลถูกบันทึกจริงหรือไม่ (ใช้ connection เดิมก่อน release)
        if (hasDataToSave) {
            try {
                const [verifyDrugs] = await connection.execute(
                    `SELECT COUNT(*) as count FROM TREATMENT1_DRUG WHERE VNO = ?`, [vno]
                );
                const [verifyProcedures] = await connection.execute(
                    `SELECT COUNT(*) as count FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?`, [vno]
                );
                console.log(`✅ [${vno}] Verification after commit:`, {
                    drugsInDB: verifyDrugs[0]?.count || 0,
                    proceduresInDB: verifyProcedures[0]?.count || 0,
                    expectedDrugs: drugsArray?.length || 0,
                    expectedProcedures: proceduresArray?.length || 0
                });

                // ✅ แจ้งเตือนถ้าข้อมูลไม่ตรง
                if (verifyDrugs[0]?.count !== (drugsArray?.length || 0)) {
                    console.error(`⚠️ [${vno}] WARNING: Drugs count mismatch! Expected: ${drugsArray?.length || 0}, Found: ${verifyDrugs[0]?.count || 0}`);
                }
                if (verifyProcedures[0]?.count !== (proceduresArray?.length || 0)) {
                    console.error(`⚠️ [${vno}] WARNING: Procedures count mismatch! Expected: ${proceduresArray?.length || 0}, Found: ${verifyProcedures[0]?.count || 0}`);
                }
            } catch (verifyError) {
                console.warn(`⚠️ [${vno}] Could not verify data after commit:`, verifyError.message);
            }
        }

        const totalTime = Date.now() - startTime;
        console.log(`✅ [${vno}] ========== SUCCESS Total request time: ${totalTime}ms ==========`);

        // ✅ ส่ง response หลัง commit เสร็จ (connection จะถูก release ใน finally block)
        res.json({
            success: true,
            message: 'อัปเดตข้อมูลการรักษาและการชำระเงินสำเร็จ',
            data: {
                VNO: vno,
                updatedItems: {
                    drugs: drugsArray.length,
                    procedures: proceduresArray.length,
                    labTests: Array.isArray(labTests) ? labTests.length : 0,
                    radioTests: Array.isArray(radioTests) ? radioTests.length : 0,
                    investigationNotes: INVESTIGATION_NOTES ? 'updated' : 'no change',
                    paymentStatus: PAYMENT_STATUS ? 'updated' : 'no change',
                    totalAmount: TOTAL_AMOUNT ? parseFloat(TOTAL_AMOUNT) : null
                }
            }
        });

    } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`❌ [${vno}] Error after ${errorTime}ms:`, {
            error: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            stack: error.stack?.substring(0, 500) // จำกัด stack trace
        });

        if (connection) {
            try {
                console.log(`🔄 Rolling back transaction for VNO: ${req.params.vno}`);
                await connection.rollback();
                console.log(`✅ Transaction rolled back for VNO: ${req.params.vno}`);
            } catch (rollbackError) {
                console.error('❌ Error rolling back transaction:', rollbackError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการรักษาและการชำระเงิน',
            error: error.message,
            code: error.code
        });
    } finally {
        // ✅ เพิ่มส่วนนี้เพื่อให้แน่ใจว่าคืน Connection เสมอ
        if (connection) {
            try {
                connection.release();
                console.log(`🔓 [${vno}] Connection released in finally block`);
            } catch (e) {
                console.error('❌ Error releasing connection:', e);
            }
        }
    }
});

// GET treatment statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { date_from, date_to } = req.query;

        let dateFilter = '';
        let params = [];

        if (date_from && date_to) {
            dateFilter = 'WHERE RDATE BETWEEN ? AND ?';
            params = [date_from, date_to];
        } else if (date_from) {
            dateFilter = 'WHERE RDATE >= ?';
            params = [date_from];
        } else if (date_to) {
            dateFilter = 'WHERE RDATE <= ?';
            params = [date_to];
        }

        const [totalCount] = await db.execute(`SELECT COUNT(*) as total FROM TREATMENT1 ${dateFilter}`, params);

        const [statusStats] = await db.execute(`
            SELECT STATUS1, COUNT(*) as count 
            FROM TREATMENT1 ${dateFilter}
            GROUP BY STATUS1
        `, params);

        const [doctorStats] = await db.execute(`
            SELECT 
                e.EMP_NAME,
                COUNT(t.VNO) as treatment_count
            FROM TREATMENT1 t
            LEFT JOIN EMPLOYEE1 e ON t.EMP_CODE = e.EMP_CODE
            ${dateFilter}
            GROUP BY t.EMP_CODE, e.EMP_NAME
            ORDER BY treatment_count DESC
            LIMIT 10
        `, params);

        const [diagnosisStats] = await db.execute(`
            SELECT 
                dx.DXNAME_THAI,
                COUNT(t.VNO) as count
            FROM TREATMENT1 t
            LEFT JOIN TABLE_DX dx ON t.DXCODE = dx.DXCODE
            ${dateFilter}
            GROUP BY t.DXCODE, dx.DXNAME_THAI
            ORDER BY count DESC
            LIMIT 10
        `, params);

        res.json({
            success: true,
            data: {
                totalTreatments: totalCount[0].total,
                byStatus: statusStats,
                byDoctor: doctorStats,
                commonDiagnoses: diagnosisStats,
                dateRange: { date_from, date_to },
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching treatment statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติข้อมูลการรักษา',
            error: error.message
        });
    }
});

router.post('/procedures/custom', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG } = req.body;

        if (!MEDICAL_PROCEDURE_CODE || !MED_PRO_NAME_THAI) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อหัตถการ'
            });
        }

        try {
            await db.execute(`
                INSERT INTO TABLE_MEDICAL_PROCEDURES 
                (MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE) 
                VALUES (?, ?, ?, 'Custom', 0)
            `, [MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG || MED_PRO_NAME_THAI]);

            res.status(201).json({
                success: true,
                message: 'เพิ่มหัตถการใหม่สำเร็จ',
                data: { MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI }
            });
        } catch (dbError) {
            if (dbError.code === 'ER_DUP_ENTRY') {
                res.json({
                    success: true,
                    message: 'หัตถการนี้มีอยู่แล้ว',
                    data: { MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI }
                });
            } else {
                throw dbError;
            }
        }
    } catch (error) {
        console.error('Error creating custom procedure:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเพิ่มหัตถการใหม่',
            error: error.message
        });
    }
});

router.get('/stats/revenue', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { date_from, date_to } = req.query;

        let dateFilter = '';
        let params = [];

        if (date_from && date_to) {
            dateFilter = 'WHERE t.PAYMENT_DATE BETWEEN ? AND ?';
            params = [date_from, date_to];
        } else if (date_from) {
            dateFilter = 'WHERE t.PAYMENT_DATE >= ?';
            params = [date_from];
        } else if (date_to) {
            dateFilter = 'WHERE t.PAYMENT_DATE <= ?';
            params = [date_to];
        } else {
            // ✅ ใช้เวลาไทยแทน CURDATE()
            const thailandDate = formatDateForDB(getThailandTime());
            const thailandYear = thailandDate.split('-')[0];
            const thailandMonth = thailandDate.split('-')[1];
            dateFilter = `WHERE YEAR(t.PAYMENT_DATE) = ${thailandYear} AND MONTH(t.PAYMENT_DATE) = ${thailandMonth}`;
        }

        const [revenueStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_treatments,
                COUNT(CASE WHEN t.PAYMENT_STATUS = 'ชำระเงินแล้ว' THEN 1 END) as paid_treatments,
                SUM(CASE WHEN t.PAYMENT_STATUS = 'ชำระเงินแล้ว' THEN t.NET_AMOUNT ELSE 0 END) as total_revenue,
                AVG(CASE WHEN t.PAYMENT_STATUS = 'ชำระเงินแล้ว' THEN t.NET_AMOUNT ELSE NULL END) as avg_revenue_per_patient,
                SUM(CASE WHEN t.PAYMENT_STATUS = 'ชำระเงินแล้ว' THEN t.DISCOUNT_AMOUNT ELSE 0 END) as total_discounts
            FROM TREATMENT1 t
            ${dateFilter} AND t.PAYMENT_STATUS IS NOT NULL
        `, params);

        const [dailyRevenue] = await db.execute(`
            SELECT 
                t.PAYMENT_DATE as date,
                COUNT(*) as treatments_count,
                SUM(t.NET_AMOUNT) as daily_revenue,
                AVG(t.NET_AMOUNT) as avg_per_treatment
            FROM TREATMENT1 t
            ${dateFilter} AND t.PAYMENT_STATUS = 'ชำระเงินแล้ว'
            GROUP BY t.PAYMENT_DATE
            ORDER BY t.PAYMENT_DATE DESC
        `, params);

        const [paymentMethods] = await db.execute(`
            SELECT 
                t.PAYMENT_METHOD,
                COUNT(*) as count,
                SUM(t.NET_AMOUNT) as total_amount
            FROM TREATMENT1 t
            ${dateFilter} AND t.PAYMENT_STATUS = 'ชำระเงินแล้ว'
            GROUP BY t.PAYMENT_METHOD
            ORDER BY total_amount DESC
        `, params);

        res.json({
            success: true,
            data: {
                summary: revenueStats[0],
                dailyRevenue: dailyRevenue,
                paymentMethods: paymentMethods,
                dateRange: { date_from, date_to }
            }
        });

    } catch (error) {
        console.error('Error fetching revenue statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติรายรับ',
            error: error.message
        });
    }
});

// ✅ GET - เช็คจำนวนครั้งที่ใช้สิทธิ์บัตรทองในเดือนนี้
router.get('/check/ucs-usage/:hncode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { hncode } = req.params;

        if (!hncode) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ HNCODE'
            });
        }

        // ✅ ใช้เวลาไทยเพื่อหาเดือนปัจจุบัน
        const thailandTime = getThailandTime();
        const currentYear = thailandTime.getFullYear();
        const currentMonth = thailandTime.getMonth() + 1; // getMonth() returns 0-11

        // ✅ นับจำนวนครั้งที่ใช้สิทธิ์บัตรทองในเดือนนี้
        // โดยนับจาก TREATMENT1 ที่:
        // - HNNO = hncode
        // - UCS_CARD = 'Y'
        // - RDATE อยู่ในเดือนปัจจุบัน
        // - STATUS1 ไม่ใช่ 'ยกเลิก' (นับเฉพาะที่เสร็จสิ้นแล้ว)
        const [rows] = await db.execute(`
            SELECT COUNT(*) as usage_count
            FROM TREATMENT1 t
            WHERE t.HNNO = ?
              AND t.UCS_CARD = 'Y'
              AND YEAR(t.RDATE) = ?
              AND MONTH(t.RDATE) = ?
              AND t.STATUS1 NOT IN ('ยกเลิก')
        `, [hncode, currentYear, currentMonth]);

        const usageCount = rows[0]?.usage_count || 0;
        const maxUsage = 2; // จำกัด 2 ครั้งต่อเดือน
        const isExceeded = usageCount >= maxUsage;

        res.json({
            success: true,
            data: {
                hncode: hncode,
                usageCount: usageCount,
                maxUsage: maxUsage,
                isExceeded: isExceeded,
                currentMonth: currentMonth,
                currentYear: currentYear,
                remainingUsage: Math.max(0, maxUsage - usageCount)
            }
        });
    } catch (error) {
        console.error('❌ Error checking UCS usage:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเช็คจำนวนครั้งที่ใช้สิทธิ์บัตรทอง',
            error: error.message
        });
    }
});

// DELETE treatment
router.delete('/:vno', async (req, res) => {
    const db = await require('../config/db');
    let connection = null;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { vno } = req.params;

        // ลบข้อมูลที่เกี่ยวข้องทั้งหมด
        await connection.execute('DELETE FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?', [vno]);
        await connection.execute('DELETE FROM TREATMENT1_DRUG WHERE VNO = ?', [vno]);
        await connection.execute('DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?', [vno]);
        await connection.execute('DELETE FROM TREATMENT1_LABORATORY WHERE VNO = ?', [vno]);
        await connection.execute('DELETE FROM TREATMENT1_RADIOLOGICAL WHERE VNO = ?', [vno]);

        // ลบข้อมูล treatment หลัก
        const [result] = await connection.execute('DELETE FROM TREATMENT1 WHERE VNO = ?', [vno]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการรักษาที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบข้อมูลการรักษาสำเร็จ',
            data: { VNO: vno }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }

        console.error('Error deleting treatment:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลการรักษา',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;