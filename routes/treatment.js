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

const ensureProcedureExists = async (connection, procedureCode, procedureName) => {
    try {
        let code = (procedureCode || '').toString();
        let name = (procedureName || '').toString();

        if (code.length > 15) {
            code = code.substring(0, 15);
        }

        const [existing] = await connection.execute(
            'SELECT MEDICAL_PROCEDURE_CODE FROM TABLE_MEDICAL_PROCEDURES WHERE MEDICAL_PROCEDURE_CODE = ? LIMIT 1',
            [code]
        );

        if (existing.length === 0) {
            await connection.execute(`
                INSERT INTO TABLE_MEDICAL_PROCEDURES 
                (MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE) 
                VALUES (?, ?, ?, 'Custom', 0)
            `, [
                code,
                name.substring(0, 255),
                name.substring(0, 255)
            ]);

            console.log(`✅ Added new procedure: ${code} - ${name}`);
        }
    } catch (error) {
        console.error('❌ Error ensuring procedure exists:', error.message);
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
                COALESCE(tdg.TYPE_DRUG_NAME, d.Type1, '') as TYPE_DRUG_NAME
            FROM TREATMENT1_DRUG td
            LEFT JOIN TABLE_DRUG d ON td.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON td.UNIT_CODE = u.UNIT_CODE
            LEFT JOIN TYPE_DRUG tdg 
                ON d.Type1 = tdg.TYPE_DRUG_CODE OR d.Type1 = tdg.TYPE_DRUG_NAME
            WHERE td.VNO = ?
            ORDER BY td.DRUG_CODE
        `, [vno]);

        console.log(`Found ${drugs.length} drugs for VNO: ${vno}`);

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
                COALESCE(u.UNIT_NAME, tmp.UNIT_CODE) as UNIT_NAME
            FROM TREATMENT1_MED_PROCEDURE tmp
            LEFT JOIN TABLE_MEDICAL_PROCEDURES mp ON tmp.MEDICAL_PROCEDURE_CODE = mp.MEDICAL_PROCEDURE_CODE
            LEFT JOIN TABLE_UNIT u ON tmp.UNIT_CODE = u.UNIT_CODE
            WHERE tmp.VNO = ?
            ORDER BY tmp.MEDICAL_PROCEDURE_CODE
        `, [vno]);

        console.log(`Found ${procedures.length} procedures for VNO: ${vno}`);

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

        console.log(`Calculated costs - Drugs: ${totalDrugCost}, Procedures: ${totalProcedureCost}, Total: ${totalCost}`);

        res.json({
            success: true,
            data: {
                treatment: treatment[0],
                diagnosis: diagnosis[0] || null,
                drugs: drugs,
                procedures: procedures,
                labTests: labTests,
                radiologicalTests: radioTests,
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
        });

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

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

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

        for (const drug of drugs) {
            if (drug.DRUG_CODE) {
                await connection.execute(`
                    INSERT INTO TREATMENT1_DRUG (VNO, DRUG_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT, NOTE1, TIME1)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [VNO, drug.DRUG_CODE, drug.QTY, drug.UNIT_CODE, drug.UNIT_PRICE, drug.AMT, drug.NOTE1, drug.TIME1]);
            }
        }

        for (const proc of procedures) {
            if (proc.MEDICAL_PROCEDURE_CODE) {
                await connection.execute(`
                    INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [VNO, proc.MEDICAL_PROCEDURE_CODE, proc.QTY, proc.UNIT_CODE, proc.UNIT_PRICE, proc.AMT]);
            }
        }

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
    const db = await require('../config/db');
    let connection = null;

    const toNull = (value) => {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        return value;
    };

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { vno } = req.params;
        const {
            VNO, HNNO, DXCODE, ICD10CODE, TREATMENT1, STATUS1,
            SYMPTOM, diagnosis, drugs = [], procedures = [],
            labTests = [], radioTests = [], INVESTIGATION_NOTES,
            WEIGHT1, HIGHT1, BT1, PR1, RR1, BP1, BP2, SPO2,
            TOTAL_AMOUNT, DISCOUNT_AMOUNT, NET_AMOUNT,
            PAYMENT_STATUS, PAYMENT_DATE, PAYMENT_TIME,
            PAYMENT_METHOD, RECEIVED_AMOUNT, CHANGE_AMOUNT, CASHIER
        } = req.body;

        console.log(`Updating treatment ${vno} with payment data:`, {
            VNO: toNull(VNO),
            HNNO: toNull(HNNO),
            SYMPTOM: toNull(SYMPTOM),
            STATUS1: toNull(STATUS1),
            PAYMENT_STATUS: toNull(PAYMENT_STATUS),
            TOTAL_AMOUNT: toNull(TOTAL_AMOUNT),
            TREATMENT_FEE: req.body.TREATMENT_FEE ? parseFloat(req.body.TREATMENT_FEE) : null, // ✅ รองรับค่ารักษาแยก
            NET_AMOUNT: toNull(NET_AMOUNT)
        });

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
            toNull(TOTAL_AMOUNT) ? parseFloat(toNull(TOTAL_AMOUNT)) : null,
            req.body.TREATMENT_FEE ? parseFloat(req.body.TREATMENT_FEE) : null, // ✅ ค่ารักษาแยก
            toNull(DISCOUNT_AMOUNT) ? parseFloat(toNull(DISCOUNT_AMOUNT)) : null,
            toNull(NET_AMOUNT) ? parseFloat(toNull(NET_AMOUNT)) : null,
            toNull(PAYMENT_STATUS),
            toNull(PAYMENT_DATE),
            toNull(PAYMENT_TIME),
            toNull(PAYMENT_METHOD),
            toNull(RECEIVED_AMOUNT) ? parseFloat(toNull(RECEIVED_AMOUNT)) : null,
            toNull(CHANGE_AMOUNT) ? parseFloat(toNull(CHANGE_AMOUNT)) : null,
            toNull(CASHIER),
            vno
        ]);

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการรักษาที่ต้องการอัปเดต'
            });
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

        if (drugs && Array.isArray(drugs) && drugs.length > 0) {
            await connection.execute(`DELETE FROM TREATMENT1_DRUG WHERE VNO = ?`, [vno]);

            for (const drug of drugs) {
                if (drug.DRUG_CODE) {
                    let unitCode = toNull(drug.UNIT_CODE) || 'TAB';

                    const [unitExists] = await connection.execute(
                        'SELECT UNIT_CODE FROM TABLE_UNIT WHERE UNIT_CODE = ?',
                        [unitCode]
                    );

                    if (unitExists.length === 0) {
                        console.warn(`Unit code ${unitCode} not found, using TAB instead`);
                        unitCode = 'TAB';
                    }

                    await connection.execute(`
                        INSERT INTO TREATMENT1_DRUG (VNO, DRUG_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT, NOTE1, TIME1)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        vno,
                        toNull(drug.DRUG_CODE),
                        toNull(drug.QTY) || 1,
                        unitCode,
                        toNull(drug.UNIT_PRICE) || 0,
                        toNull(drug.AMT) || 0,
                        toNull(drug.NOTE1) || '',
                        toNull(drug.TIME1) || ''
                    ]);
                }
            }
        }

        if (procedures && Array.isArray(procedures) && procedures.length > 0) {
            await connection.execute(`DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?`, [vno]);

            for (const proc of procedures) {
                let procedureCode = toNull(proc.PROCEDURE_CODE) || toNull(proc.MEDICAL_PROCEDURE_CODE);
                const procedureName = toNull(proc.PROCEDURE_NAME) || 'หัตถการที่ไม่ระบุชื่อ';

                if (procedureCode) {
                    if (procedureCode.length > 15) {
                        procedureCode = procedureCode.substring(0, 15);
                    }

                    let unitCode = toNull(proc.UNIT_CODE) || 'TIMES';

                    const [unitExists] = await connection.execute(
                        'SELECT UNIT_CODE FROM TABLE_UNIT WHERE UNIT_CODE = ?',
                        [unitCode]
                    );

                    if (unitExists.length === 0) {
                        try {
                            await connection.execute(
                                'INSERT INTO TABLE_UNIT (UNIT_CODE, UNIT_NAME) VALUES (?, ?)',
                                [unitCode, 'ครั้ง']
                            );
                            console.log(`Added new unit: ${unitCode}`);
                        } catch (unitError) {
                            const [firstUnit] = await connection.execute(
                                'SELECT UNIT_CODE FROM TABLE_UNIT LIMIT 1'
                            );
                            unitCode = firstUnit.length > 0 ? firstUnit[0].UNIT_CODE : 'PC';
                            console.log(`Using existing unit: ${unitCode}`);
                        }
                    }

                    await ensureProcedureExists(connection, procedureCode, procedureName);

                    try {
                        await connection.execute(`
                            INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [
                            vno,
                            procedureCode,
                            toNull(proc.QTY) || 1,
                            unitCode,
                            toNull(proc.UNIT_PRICE) || 0,
                            toNull(proc.AMT) || 0
                        ]);
                        console.log(`Successfully inserted procedure: ${procedureCode}`);
                    } catch (procError) {
                        console.error(`Error inserting procedure ${procedureCode}:`, procError);

                        if (procError.code === 'ER_NO_REFERENCED_ROW_2' || procError.code === 'ER_DATA_TOO_LONG') {
                            const timestamp = Date.now().toString().slice(-6);
                            const newCode = `P${timestamp}`;
                            console.log(`Creating fallback code: ${newCode}`);

                            await ensureProcedureExists(connection, newCode, procedureName);

                            await connection.execute(`
                                INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
                                VALUES (?, ?, ?, ?, ?, ?)
                            `, [
                                vno,
                                newCode,
                                toNull(proc.QTY) || 1,
                                unitCode,
                                toNull(proc.UNIT_PRICE) || 0,
                                toNull(proc.AMT) || 0
                            ]);
                            console.log(`Successfully inserted fallback procedure: ${newCode}`);
                        } else {
                            throw procError;
                        }
                    }
                }
            }
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

        await connection.commit();

        res.json({
            success: true,
            message: 'อัปเดตข้อมูลการรักษาและการชำระเงินสำเร็จ',
            data: {
                VNO: vno,
                updatedItems: {
                    drugs: drugs.length,
                    procedures: procedures.length,
                    labTests: labTests.length,
                    radioTests: radioTests.length,
                    investigationNotes: INVESTIGATION_NOTES ? 'updated' : 'no change',
                    paymentStatus: PAYMENT_STATUS ? 'updated' : 'no change',
                    totalAmount: TOTAL_AMOUNT ? parseFloat(TOTAL_AMOUNT) : null
                }
            }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }

        console.error('Error updating treatment with payment data:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการรักษาและการชำระเงิน',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
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