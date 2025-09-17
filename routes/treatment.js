const express = require('express');
const router = express.Router();

const ensureProcedureExists = async (connection, procedureCode, procedureName) => {
    try {
        // ตัดรหัสให้สั้นลงถ้ายาวเกินไป
        if (procedureCode.length > 15) {
            procedureCode = procedureCode.substring(0, 15);
        }

        // ตรวจสอบว่ามีหัตถการนี้อยู่หรือไม่
        const [existing] = await connection.execute(
            'SELECT MEDICAL_PROCEDURE_CODE FROM TABLE_MEDICAL_PROCEDURES WHERE MEDICAL_PROCEDURE_CODE = ?',
            [procedureCode]
        );

        if (existing.length === 0) {
            // ถ้าไม่มี ให้เพิ่มใหม่
            await connection.execute(`
                INSERT INTO TABLE_MEDICAL_PROCEDURES 
                (MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE) 
                VALUES (?, ?, ?, 'Custom', 0)
            `, [procedureCode, procedureName.substring(0, 255), procedureName.substring(0, 255)]);

            console.log(`Added new procedure: ${procedureCode} - ${procedureName}`);
        }
    } catch (error) {
        console.error('Error ensuring procedure exists:', error);
        // ไม่ throw error เพื่อไม่ให้กระทบการทำงาน
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
                -- เพิ่ม payment fields
                t.TOTAL_AMOUNT, t.DISCOUNT_AMOUNT, t.NET_AMOUNT,
                t.PAYMENT_STATUS, t.PAYMENT_DATE, t.PAYMENT_TIME,
                t.PAYMENT_METHOD, t.RECEIVED_AMOUNT, t.CHANGE_AMOUNT, t.CASHIER,
                -- patient info
                p.PRENAME, p.NAME1, p.SURNAME, p.AGE, p.SEX, p.TEL1,
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
// GET treatment by VNO with full details - แก้ไขให้ตรงกับ TABLE_DRUG ที่เหลือเฉพาะ fields จำเป็น
router.get('/:vno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { vno } = req.params;

        console.log(`Fetching treatment details for VNO: ${vno}`);

        // Get main treatment info
        const [treatment] = await db.execute(`
            SELECT 
                t.*,
                p.PRENAME, p.NAME1, p.SURNAME, p.AGE, p.SEX, p.IDNO, p.TEL1,
                p.BLOOD_GROUP1, p.ADDR1, p.DRUG_ALLERGY, p.FOOD_ALLERGIES,
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

        // Get diagnosis details
        const [diagnosis] = await db.execute(`
            SELECT * FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?
        `, [vno]);

        // Get drugs - แก้ไขให้ใช้เฉพาะ fields ที่มีจริงใน TABLE_DRUG
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
                COALESCE(u.UNIT_NAME, td.UNIT_CODE) as UNIT_NAME
            FROM TREATMENT1_DRUG td
            LEFT JOIN TABLE_DRUG d ON td.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON td.UNIT_CODE = u.UNIT_CODE
            WHERE td.VNO = ?
            ORDER BY td.DRUG_CODE
        `, [vno]);

        console.log(`Found ${drugs.length} drugs for VNO: ${vno}`);

        // Get procedures
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

        // Get lab tests
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

        // Get radiological tests
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

        // Calculate total cost
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

        // แปลงเป็น integer และ validate
        const limitInt = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
        const pageInt = Math.max(1, parseInt(page, 10) || 1);
        const offset = (pageInt - 1) * limitInt;

        console.log(`Fetching treatments - HN: ${hn}, Page: ${pageInt}, Limit: ${limitInt}, Offset: ${offset}`);

        const [rows] = await db.execute(`
            SELECT 
                t.VNO, t.RDATE, t.TRDATE, t.STATUS1, t.SYMPTOM, t.TREATMENT1,
                e.EMP_NAME,
                dx.DXNAME_THAI,
                icd.ICD10NAME_THAI
            FROM TREATMENT1 t
            LEFT JOIN EMPLOYEE1 e ON t.EMP_CODE = e.EMP_CODE
            LEFT JOIN TABLE_DX dx ON t.DXCODE = dx.DXCODE
            LEFT JOIN TABLE_ICD10 icd ON t.ICD10CODE = icd.ICD10CODE
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
            QUEUE_ID, // เพิ่ม QUEUE_ID
            diagnosis,
            drugs = [],
            procedures = [],
            labTests = [],
            radioTests = [],
            INVESTIGATION_NOTES // เพิ่มฟิลด์ใหม่
        } = req.body;

        if (!HNNO || !EMP_CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Hospital Number และรหัสแพทย์'
            });
        }

        // ✅ สร้าง VN Number ที่ถูกต้องจากฐานข้อมูล
        const today = new Date();
        const buddhistYear = (today.getFullYear() + 543).toString().slice(-2); // 68
        const month = String(today.getMonth() + 1).padStart(2, '0'); // 09
        const day = String(today.getDate()).padStart(2, '0'); // 03

        // หาเลขรันนิ่งถัดไปจากฐานข้อมูล
        const [vnCount] = await connection.execute(`
            SELECT COUNT(*) + 1 as next_number
            FROM TREATMENT1 
            WHERE VNO LIKE ? AND DATE(SYSTEM_DATE) = CURDATE()
        `, [`VN${buddhistYear}${month}${day}%`]);

        const runningNumber = vnCount[0].next_number.toString().padStart(3, '0');
        const VNO = `VN${buddhistYear}${month}${day}${runningNumber}`;

        console.log(`🔢 Generated VNO: ${VNO} (Running: ${runningNumber})`);

        // Insert main treatment
        await connection.execute(`
            INSERT INTO TREATMENT1 (
                VNO, HNNO, RDATE, TRDATE, WEIGHT1, HIGHT1, BT1, BP1, BP2, 
                RR1, PR1, SPO2, SYMPTOM, DXCODE, ICD10CODE, TREATMENT1,
                APPOINTMENT_DATE, APPOINTMENT_TDATE, EMP_CODE, EMP_CODE1,
                SYSTEM_DATE, SYSTEM_TIME, STATUS1, QUEUE_ID, INVESTIGATION_NOTES
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?, ?, ?)
        `, [
            VNO, // ✅ ใช้ VNO ที่สร้างใหม่
            toNull(HNNO),
            toNull(RDATE) || today.toISOString().split('T')[0], // ถ้าไม่มี RDATE ใช้วันนี้
            toNull(TRDATE),
            toNull(WEIGHT1), toNull(HIGHT1), toNull(BT1), toNull(BP1), toNull(BP2),
            toNull(RR1), toNull(PR1), toNull(SPO2), toNull(SYMPTOM),
            toNull(DXCODE), toNull(ICD10CODE), toNull(TREATMENT1),
            toNull(APPOINTMENT_DATE), toNull(APPOINTMENT_TDATE),
            toNull(EMP_CODE), toNull(EMP_CODE1), toNull(STATUS1),
            toNull(QUEUE_ID), toNull(INVESTIGATION_NOTES)
        ]);

        // Insert diagnosis if provided
        if (diagnosis && (diagnosis.CHIEF_COMPLAINT || diagnosis.PRESENT_ILL || diagnosis.PHYSICAL_EXAM || diagnosis.PLAN1)) {
            await connection.execute(`
                INSERT INTO TREATMENT1_DIAGNOSIS (VNO, CHIEF_COMPLAINT, PRESENT_ILL, PHYSICAL_EXAM, PLAN1)
                VALUES (?, ?, ?, ?, ?)
            `, [VNO, diagnosis.CHIEF_COMPLAINT, diagnosis.PRESENT_ILL, diagnosis.PHYSICAL_EXAM, diagnosis.PLAN1]);
        }

        // Insert drugs
        for (const drug of drugs) {
            if (drug.DRUG_CODE) {
                await connection.execute(`
                    INSERT INTO TREATMENT1_DRUG (VNO, DRUG_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT, NOTE1, TIME1)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [VNO, drug.DRUG_CODE, drug.QTY, drug.UNIT_CODE, drug.UNIT_PRICE, drug.AMT, drug.NOTE1, drug.TIME1]);
            }
        }

        // Insert procedures
        for (const proc of procedures) {
            if (proc.MEDICAL_PROCEDURE_CODE) {
                await connection.execute(`
                    INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [VNO, proc.MEDICAL_PROCEDURE_CODE, proc.QTY, proc.UNIT_CODE, proc.UNIT_PRICE, proc.AMT]);
            }
        }

        // Insert lab tests
        for (const lab of labTests) {
            if (lab.LABCODE) {
                await connection.execute(`
                    INSERT INTO TREATMENT1_LABORATORY (VNO, LABCODE) VALUES (?, ?)
                `, [VNO, lab.LABCODE]);
            }
        }

        // Insert radiological tests
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

// PUT /:vno 
// PUT /:vno - แก้ไขให้ preserve ข้อมูลทั้งหมดไม่ให้หาย
// router.put('/:vno', async (req, res) => {
//     const db = await require('../config/db');
//     let connection = null;

//     const toNull = (value) => value === undefined || value === '' ? null : value;

//     try {
//         connection = await db.getConnection();
//         await connection.beginTransaction();

//         const { vno } = req.params;

//         console.log(`🔍 TREATMENT UPDATE: VNO ${vno}`);
//         console.log(`📥 Request body keys:`, Object.keys(req.body));

//         // ดึงข้อมูลเดิมทั้งหมดก่อนอัพเดท - รวมข้อมูลที่เกี่ยวข้อง
//         const [existingData] = await connection.execute(`
//             SELECT * FROM TREATMENT1 WHERE VNO = ?
//         `, [vno]);

//         if (existingData.length === 0) {
//             await connection.rollback();
//             return res.status(404).json({
//                 success: false,
//                 message: 'ไม่พบข้อมูลการรักษาที่ต้องการอัปเดต'
//             });
//         }

//         const existing = existingData[0];

//         // ✅ ดึงข้อมูล diagnosis เดิม
//         const [existingDiagnosis] = await connection.execute(`
//             SELECT * FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?
//         `, [vno]);

//         // ✅ ดึงข้อมูล drugs เดิม
//         const [existingDrugs] = await connection.execute(`
//             SELECT * FROM TREATMENT1_DRUG WHERE VNO = ?
//         `, [vno]);

//         // ✅ ดึงข้อมูล procedures เดิม
//         const [existingProcedures] = await connection.execute(`
//             SELECT * FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?
//         `, [vno]);

//         // ✅ ดึงข้อมูล lab tests เดิม
//         const [existingLabTests] = await connection.execute(`
//             SELECT * FROM TREATMENT1_LABORATORY WHERE VNO = ?
//         `, [vno]);

//         // ✅ ดึงข้อมูล radiological tests เดิม
//         const [existingRadioTests] = await connection.execute(`
//             SELECT * FROM TREATMENT1_RADIOLOGICAL WHERE VNO = ?
//         `, [vno]);

//         console.log(`📊 Existing data counts:`, {
//             diagnosis: existingDiagnosis.length,
//             drugs: existingDrugs.length,
//             procedures: existingProcedures.length,
//             labTests: existingLabTests.length,
//             radioTests: existingRadioTests.length
//         });

//         const {
//             STATUS1, SYMPTOM, DXCODE, ICD10CODE, TREATMENT1, INVESTIGATION_NOTES,
//             // Vital Signs
//             WEIGHT1, HIGHT1, BT1, BP1, BP2, RR1, PR1, SPO2, RDATE,
//             // Payment fields
//             TOTAL_AMOUNT, DISCOUNT_AMOUNT, NET_AMOUNT, PAYMENT_STATUS,
//             PAYMENT_DATE, PAYMENT_TIME, PAYMENT_METHOD, RECEIVED_AMOUNT,
//             CHANGE_AMOUNT, CASHIER,
//             // Related data - อาจจะส่งมาหรือไม่ส่งมา
//             diagnosis, drugs, procedures, labTests, radioTests
//         } = req.body;

//         // ✅ สร้าง merged vital signs data
//         const mergedVitals = {
//             RDATE: toNull(RDATE) || existing.RDATE,
//             WEIGHT1: WEIGHT1 !== undefined ? (parseFloat(WEIGHT1) || null) : existing.WEIGHT1,
//             HIGHT1: HIGHT1 !== undefined ? (parseFloat(HIGHT1) || null) : existing.HIGHT1,
//             BT1: BT1 !== undefined ? (parseFloat(BT1) || null) : existing.BT1,
//             BP1: BP1 !== undefined ? (parseInt(BP1) || null) : existing.BP1,
//             BP2: BP2 !== undefined ? (parseInt(BP2) || null) : existing.BP2,
//             RR1: RR1 !== undefined ? (parseInt(RR1) || null) : existing.RR1,
//             PR1: PR1 !== undefined ? (parseInt(PR1) || null) : existing.PR1,
//             SPO2: SPO2 !== undefined ? (parseInt(SPO2) || null) : existing.SPO2
//         };

//         // สร้าง dynamic update query สำหรับ main table
//         const updateFields = [];
//         const updateValues = [];

//         // ฟิลด์หลักที่ต้องอัพเดท
//         if (req.body.hasOwnProperty('STATUS1') && STATUS1 !== undefined) {
//             updateFields.push('STATUS1 = ?');
//             updateValues.push(STATUS1);
//         }

//         if (req.body.hasOwnProperty('SYMPTOM') && SYMPTOM !== undefined) {
//             updateFields.push('SYMPTOM = ?');
//             updateValues.push(SYMPTOM);
//         }

//         if (req.body.hasOwnProperty('DXCODE') && DXCODE !== undefined) {
//             updateFields.push('DXCODE = ?');
//             updateValues.push(DXCODE);
//         }

//         if (req.body.hasOwnProperty('ICD10CODE') && ICD10CODE !== undefined) {
//             updateFields.push('ICD10CODE = ?');
//             updateValues.push(ICD10CODE);
//         }

//         if (req.body.hasOwnProperty('TREATMENT1') && TREATMENT1 !== undefined) {
//             updateFields.push('TREATMENT1 = ?');
//             updateValues.push(TREATMENT1);
//         }

//         if (req.body.hasOwnProperty('INVESTIGATION_NOTES') && INVESTIGATION_NOTES !== undefined) {
//             updateFields.push('INVESTIGATION_NOTES = ?');
//             updateValues.push(INVESTIGATION_NOTES);
//         }

//         // Payment fields
//         if (req.body.hasOwnProperty('TOTAL_AMOUNT') && TOTAL_AMOUNT !== undefined) {
//             updateFields.push('TOTAL_AMOUNT = ?');
//             updateValues.push(parseFloat(TOTAL_AMOUNT) || 0);
//         }
//         if (req.body.hasOwnProperty('DISCOUNT_AMOUNT') && DISCOUNT_AMOUNT !== undefined) {
//             updateFields.push('DISCOUNT_AMOUNT = ?');
//             updateValues.push(parseFloat(DISCOUNT_AMOUNT) || 0);
//         }
//         if (req.body.hasOwnProperty('NET_AMOUNT') && NET_AMOUNT !== undefined) {
//             updateFields.push('NET_AMOUNT = ?');
//             updateValues.push(parseFloat(NET_AMOUNT) || 0);
//         }
//         if (req.body.hasOwnProperty('PAYMENT_STATUS') && PAYMENT_STATUS !== undefined) {
//             updateFields.push('PAYMENT_STATUS = ?');
//             updateValues.push(PAYMENT_STATUS);
//         }
//         if (req.body.hasOwnProperty('PAYMENT_DATE') && PAYMENT_DATE !== undefined) {
//             updateFields.push('PAYMENT_DATE = ?');
//             updateValues.push(PAYMENT_DATE);
//         }
//         if (req.body.hasOwnProperty('PAYMENT_TIME') && PAYMENT_TIME !== undefined) {
//             updateFields.push('PAYMENT_TIME = ?');
//             updateValues.push(PAYMENT_TIME);
//         }
//         if (req.body.hasOwnProperty('PAYMENT_METHOD') && PAYMENT_METHOD !== undefined) {
//             updateFields.push('PAYMENT_METHOD = ?');
//             updateValues.push(PAYMENT_METHOD);
//         }
//         if (req.body.hasOwnProperty('RECEIVED_AMOUNT') && RECEIVED_AMOUNT !== undefined) {
//             updateFields.push('RECEIVED_AMOUNT = ?');
//             updateValues.push(parseFloat(RECEIVED_AMOUNT) || 0);
//         }
//         if (req.body.hasOwnProperty('CHANGE_AMOUNT') && CHANGE_AMOUNT !== undefined) {
//             updateFields.push('CHANGE_AMOUNT = ?');
//             updateValues.push(parseFloat(CHANGE_AMOUNT) || 0);
//         }
//         if (req.body.hasOwnProperty('CASHIER') && CASHIER !== undefined) {
//             updateFields.push('CASHIER = ?');
//             updateValues.push(CASHIER);
//         }

//         // ✅ เพิ่ม vital signs ทุกตัวเข้าไปใน update ทุกครั้ง
//         updateFields.push(
//             'RDATE = ?', 'WEIGHT1 = ?', 'HIGHT1 = ?', 'BT1 = ?',
//             'BP1 = ?', 'BP2 = ?', 'RR1 = ?', 'PR1 = ?', 'SPO2 = ?'
//         );
//         updateValues.push(
//             mergedVitals.RDATE, mergedVitals.WEIGHT1, mergedVitals.HIGHT1, mergedVitals.BT1,
//             mergedVitals.BP1, mergedVitals.BP2, mergedVitals.RR1, mergedVitals.PR1, mergedVitals.SPO2
//         );

//         // อัพเดทข้อมูลหลัก
//         if (updateFields.length > 0) {
//             updateValues.push(vno);
//             const updateQuery = `UPDATE TREATMENT1 SET ${updateFields.join(', ')} WHERE VNO = ?`;

//             const [updateResult] = await connection.execute(updateQuery, updateValues);
//             console.log(`✅ Main fields updated - affected rows: ${updateResult.affectedRows}`);
//         }

//         // ✅ จัดการ diagnosis - ถ้าไม่ส่งมา ใช้ข้อมูลเดิม
//         if (req.body.hasOwnProperty('diagnosis')) {
//             // ส่งมาใหม่ - ลบเก่าแล้วใส่ใหม่
//             await connection.execute('DELETE FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?', [vno]);

//             if (diagnosis && Object.keys(diagnosis).length > 0 &&
//                 (diagnosis.CHIEF_COMPLAINT || diagnosis.PRESENT_ILL || diagnosis.PHYSICAL_EXAM || diagnosis.PLAN1)) {
//                 await connection.execute(`
//                     INSERT INTO TREATMENT1_DIAGNOSIS (VNO, CHIEF_COMPLAINT, PRESENT_ILL, PHYSICAL_EXAM, PLAN1)
//                     VALUES (?, ?, ?, ?, ?)
//                 `, [vno, diagnosis.CHIEF_COMPLAINT, diagnosis.PRESENT_ILL, diagnosis.PHYSICAL_EXAM, diagnosis.PLAN1]);
//                 console.log(`Updated diagnosis for VNO: ${vno}`);
//             }
//         } else {
//             // ไม่ส่งมา - เก็บข้อมูลเดิมไว้
//             console.log(`Preserved existing diagnosis for VNO: ${vno} (${existingDiagnosis.length} records)`);
//         }

//         // ✅ จัดการ drugs - ถ้าไม่ส่งมา ใช้ข้อมูลเดิม
//         if (req.body.hasOwnProperty('drugs')) {
//             // ส่งมาใหม่ - ลบเก่าแล้วใส่ใหม่
//             await connection.execute('DELETE FROM TREATMENT1_DRUG WHERE VNO = ?', [vno]);

//             if (Array.isArray(drugs) && drugs.length > 0) {
//                 for (const drug of drugs) {
//                     if (drug.DRUG_CODE) {
//                         await connection.execute(`
//                             INSERT INTO TREATMENT1_DRUG (VNO, DRUG_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT, NOTE1, TIME1)
//                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//                         `, [
//                             vno, drug.DRUG_CODE, drug.QTY || 1, drug.UNIT_CODE || 'TAB',
//                             drug.UNIT_PRICE || 0, drug.AMT || 0, drug.NOTE1 || '', drug.TIME1 || ''
//                         ]);
//                     }
//                 }
//                 console.log(`Updated ${drugs.length} drugs for VNO: ${vno}`);
//             }
//         } else if (existingDrugs.length > 0) {
//             // ไม่ส่งมา แต่มีข้อมูลเดิม - เก็บข้อมูลเดิมไว้
//             console.log(`Preserved existing drugs for VNO: ${vno} (${existingDrugs.length} records)`);
//         }

//         // ✅ จัดการ procedures - ถ้าไม่ส่งมา ใช้ข้อมูลเดิม
//         if (req.body.hasOwnProperty('procedures')) {
//             // ส่งมาใหม่ - ลบเก่าแล้วใส่ใหม่
//             await connection.execute('DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?', [vno]);

//             if (Array.isArray(procedures) && procedures.length > 0) {
//                 for (const proc of procedures) {
//                     if (proc.MEDICAL_PROCEDURE_CODE || proc.PROCEDURE_CODE) {
//                         const procedureCode = proc.MEDICAL_PROCEDURE_CODE || proc.PROCEDURE_CODE;

//                         // ตรวจสอบและเพิ่มหัตถการใหม่ถ้าจำเป็น
//                         await ensureProcedureExists(connection, procedureCode, proc.PROCEDURE_NAME);

//                         await connection.execute(`
//                             INSERT INTO TREATMENT1_MED_PROCEDURE (VNO, MEDICAL_PROCEDURE_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT)
//                             VALUES (?, ?, ?, ?, ?, ?)
//                         `, [
//                             vno, procedureCode, proc.QTY || 1, proc.UNIT_CODE || 'ครั้ง',
//                             proc.UNIT_PRICE || 0, proc.AMT || 0
//                         ]);
//                     }
//                 }
//                 console.log(`Updated ${procedures.length} procedures for VNO: ${vno}`);
//             }
//         } else if (existingProcedures.length > 0) {
//             // ไม่ส่งมา แต่มีข้อมูลเดิม - เก็บข้อมูลเดิมไว้
//             console.log(`Preserved existing procedures for VNO: ${vno} (${existingProcedures.length} records)`);
//         }

//         // ✅ จัดการ lab tests - ถ้าไม่ส่งมา ใช้ข้อมูลเดิม
//         if (req.body.hasOwnProperty('labTests')) {
//             // ส่งมาใหม่ - ลบเก่าแล้วใส่ใหม่
//             await connection.execute('DELETE FROM TREATMENT1_LABORATORY WHERE VNO = ?', [vno]);

//             if (Array.isArray(labTests) && labTests.length > 0) {
//                 for (const lab of labTests) {
//                     if (lab.LABCODE) {
//                         await connection.execute(`
//                             INSERT INTO TREATMENT1_LABORATORY (VNO, LABCODE) VALUES (?, ?)
//                         `, [vno, lab.LABCODE]);
//                     }
//                 }
//                 console.log(`Updated ${labTests.length} lab tests for VNO: ${vno}`);
//             }
//         } else if (existingLabTests.length > 0) {
//             // ไม่ส่งมา แต่มีข้อมูลเดิม - เก็บข้อมูลเดิมไว้
//             console.log(`Preserved existing lab tests for VNO: ${vno} (${existingLabTests.length} records)`);
//         }

//         // ✅ จัดการ radiological tests - ถ้าไม่ส่งมา ใช้ข้อมูลเดิม
//         if (req.body.hasOwnProperty('radioTests')) {
//             // ส่งมาใหม่ - ลบเก่าแล้วใส่ใหม่
//             await connection.execute('DELETE FROM TREATMENT1_RADIOLOGICAL WHERE VNO = ?', [vno]);

//             if (Array.isArray(radioTests) && radioTests.length > 0) {
//                 for (const radio of radioTests) {
//                     if (radio.RLCODE) {
//                         await connection.execute(`
//                             INSERT INTO TREATMENT1_RADIOLOGICAL (VNO, RLCODE) VALUES (?, ?)
//                         `, [vno, radio.RLCODE]);
//                     }
//                 }
//                 console.log(`Updated ${radioTests.length} radiological tests for VNO: ${vno}`);
//             }
//         } else if (existingRadioTests.length > 0) {
//             // ไม่ส่งมา แต่มีข้อมูลเดิม - เก็บข้อมูลเดิมไว้
//             console.log(`Preserved existing radio tests for VNO: ${vno} (${existingRadioTests.length} records)`);
//         }

//         // ตรวจสอบข้อมูลหลังอัพเดท
//         const [finalCounts] = await connection.execute(`
//             SELECT 
//                 (SELECT COUNT(*) FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?) as diagnosis_count,
//                 (SELECT COUNT(*) FROM TREATMENT1_DRUG WHERE VNO = ?) as drugs_count,
//                 (SELECT COUNT(*) FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?) as procedures_count,
//                 (SELECT COUNT(*) FROM TREATMENT1_LABORATORY WHERE VNO = ?) as lab_count,
//                 (SELECT COUNT(*) FROM TREATMENT1_RADIOLOGICAL WHERE VNO = ?) as radio_count
//         `, [vno, vno, vno, vno, vno]);

//         console.log(`📊 Final data counts after update:`, {
//             diagnosis: finalCounts[0].diagnosis_count,
//             drugs: finalCounts[0].drugs_count,
//             procedures: finalCounts[0].procedures_count,
//             labTests: finalCounts[0].lab_count,
//             radioTests: finalCounts[0].radio_count
//         });

//         await connection.commit();
//         console.log(`✅ Transaction committed successfully for VNO: ${vno} with all data preserved`);

//         res.json({
//             success: true,
//             message: 'อัปเดตข้อมูลการรักษาสำเร็จ (รักษาข้อมูลทั้งหมดไว้)',
//             data: {
//                 VNO: vno,
//                 preservedVitals: mergedVitals,
//                 dataCounts: {
//                     diagnosis: finalCounts[0].diagnosis_count,
//                     drugs: finalCounts[0].drugs_count,
//                     procedures: finalCounts[0].procedures_count,
//                     labTests: finalCounts[0].lab_count,
//                     radioTests: finalCounts[0].radio_count
//                 }
//             }
//         });

//     } catch (error) {
//         if (connection) {
//             await connection.rollback();
//         }
//         console.error(`Error updating treatment VNO: ${req.params.vno}`, error);
//         res.status(500).json({
//             success: false,
//             message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการรักษา',
//             error: error.message
//         });
//     } finally {
//         if (connection) {
//             connection.release();
//         }
//     }
// });

router.put('/:vno', async (req, res) => {
    const db = await require('../config/db');
    let connection = null;

    const toNull = (value) => value === undefined || value === '' ? null : value;

    // helper function กัน vitalsign หาย
    const parseOrKeep = (value, oldValue) => {
        if (value === undefined) return oldValue;        // ไม่ส่งมา → เก็บค่าเก่า
        if (value === null || value === '') return null; // ตั้งใจลบ → NULL
        if (!isNaN(parseFloat(value))) return parseFloat(value); // ส่งตัวเลขมา → ใช้ค่าใหม่
        return oldValue; // กันพัง
    };

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { vno } = req.params;

        console.log(`🔍 TREATMENT UPDATE: VNO ${vno}`);
        console.log(`📥 Request body keys:`, Object.keys(req.body));

        // ดึงข้อมูลเดิม
        const [existingData] = await connection.execute(
            `SELECT * FROM TREATMENT1 WHERE VNO = ?`,
            [vno]
        );
        if (existingData.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการรักษาที่ต้องการอัปเดต',
            });
        }
        const existing = existingData[0];

        // destructure
        const {
            STATUS1, SYMPTOM, DXCODE, ICD10CODE, TREATMENT1, INVESTIGATION_NOTES,
            WEIGHT1, HIGHT1, BT1, BP1, BP2, RR1, PR1, SPO2, RDATE,
            TOTAL_AMOUNT, DISCOUNT_AMOUNT, NET_AMOUNT, PAYMENT_STATUS,
            PAYMENT_DATE, PAYMENT_TIME, PAYMENT_METHOD, RECEIVED_AMOUNT,
            CHANGE_AMOUNT, CASHIER,
            diagnosis, drugs, procedures, labTests, radioTests,
        } = req.body;

        // === Update main table dynamic ===
        const updateFields = [];
        const updateValues = [];

        const addField = (field, value) => {
            if (req.body.hasOwnProperty(field)) {
                updateFields.push(`${field} = ?`);
                updateValues.push(value);
            }
        };

        addField('STATUS1', STATUS1);
        addField('SYMPTOM', SYMPTOM);
        addField('DXCODE', DXCODE);
        addField('ICD10CODE', ICD10CODE);
        addField('TREATMENT1', TREATMENT1);
        addField('INVESTIGATION_NOTES', INVESTIGATION_NOTES);
        addField('TOTAL_AMOUNT', TOTAL_AMOUNT ? parseFloat(TOTAL_AMOUNT) : existing.TOTAL_AMOUNT);
        addField('DISCOUNT_AMOUNT', DISCOUNT_AMOUNT ? parseFloat(DISCOUNT_AMOUNT) : existing.DISCOUNT_AMOUNT);
        addField('NET_AMOUNT', NET_AMOUNT ? parseFloat(NET_AMOUNT) : existing.NET_AMOUNT);
        addField('PAYMENT_STATUS', PAYMENT_STATUS ?? existing.PAYMENT_STATUS);
        addField('PAYMENT_DATE', PAYMENT_DATE ?? existing.PAYMENT_DATE);
        addField('PAYMENT_TIME', PAYMENT_TIME ?? existing.PAYMENT_TIME);
        addField('PAYMENT_METHOD', PAYMENT_METHOD ?? existing.PAYMENT_METHOD);
        addField('RECEIVED_AMOUNT', RECEIVED_AMOUNT ? parseFloat(RECEIVED_AMOUNT) : existing.RECEIVED_AMOUNT);
        addField('CHANGE_AMOUNT', CHANGE_AMOUNT ? parseFloat(CHANGE_AMOUNT) : existing.CHANGE_AMOUNT);
        addField('CASHIER', CASHIER ?? existing.CASHIER);

        // vitalsign
        const mergedVitals = {
            RDATE: req.body.hasOwnProperty("RDATE") ? toNull(RDATE) : existing.RDATE,
            WEIGHT1: parseOrKeep(WEIGHT1, existing.WEIGHT1),
            HIGHT1: parseOrKeep(HIGHT1, existing.HIGHT1),
            BT1: parseOrKeep(BT1, existing.BT1),
            BP1: parseOrKeep(BP1, existing.BP1),
            BP2: parseOrKeep(BP2, existing.BP2),
            RR1: parseOrKeep(RR1, existing.RR1),
            PR1: parseOrKeep(PR1, existing.PR1),
            SPO2: parseOrKeep(SPO2, existing.SPO2),
        };

        updateFields.push(
            'RDATE = ?', 'WEIGHT1 = ?', 'HIGHT1 = ?', 'BT1 = ?',
            'BP1 = ?', 'BP2 = ?', 'RR1 = ?', 'PR1 = ?', 'SPO2 = ?'
        );
        updateValues.push(
            mergedVitals.RDATE, mergedVitals.WEIGHT1, mergedVitals.HIGHT1,
            mergedVitals.BT1, mergedVitals.BP1, mergedVitals.BP2,
            mergedVitals.RR1, mergedVitals.PR1, mergedVitals.SPO2
        );

        if (updateFields.length > 0) {
            updateValues.push(vno);
            const updateQuery = `UPDATE TREATMENT1 SET ${updateFields.join(', ')} WHERE VNO = ?`;
            await connection.execute(updateQuery, updateValues);
        }

        // === Diagnosis ===
        if (req.body.hasOwnProperty('diagnosis') && diagnosis) {
            const [exist] = await connection.execute(
                `SELECT * FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?`, [vno]
            );
            if (exist.length > 0) {
                await connection.execute(`
            UPDATE TREATMENT1_DIAGNOSIS
            SET CHIEF_COMPLAINT=?, PRESENT_ILL=?, PHYSICAL_EXAM=?, PLAN1=?
            WHERE VNO=?`,
                    [
                        diagnosis.CHIEF_COMPLAINT ?? exist[0].CHIEF_COMPLAINT,
                        diagnosis.PRESENT_ILL ?? exist[0].PRESENT_ILL,
                        diagnosis.PHYSICAL_EXAM ?? exist[0].PHYSICAL_EXAM,
                        diagnosis.PLAN1 ?? exist[0].PLAN1,
                        vno
                    ]
                );
            } else {
                await connection.execute(`
            INSERT INTO TREATMENT1_DIAGNOSIS (VNO, CHIEF_COMPLAINT, PRESENT_ILL, PHYSICAL_EXAM, PLAN1)
            VALUES (?, ?, ?, ?, ?)`,
                    [vno, diagnosis.CHIEF_COMPLAINT, diagnosis.PRESENT_ILL, diagnosis.PHYSICAL_EXAM, diagnosis.PLAN1]
                );
            }
        }

        // === Drugs ===
        if (req.body.hasOwnProperty('drugs') && Array.isArray(drugs)) {
            for (const drug of drugs) {
                if (!drug.DRUG_CODE) continue;
                const [exist] = await connection.execute(
                    `SELECT * FROM TREATMENT1_DRUG WHERE VNO=? AND DRUG_CODE=?`,
                    [vno, drug.DRUG_CODE]
                );
                if (exist.length > 0) {
                    await connection.execute(`
              UPDATE TREATMENT1_DRUG
              SET QTY=?, UNIT_CODE=?, UNIT_PRICE=?, AMT=?, NOTE1=?, TIME1=?
              WHERE VNO=? AND DRUG_CODE=?`,
                        [
                            drug.QTY ?? exist[0].QTY,
                            drug.UNIT_CODE ?? exist[0].UNIT_CODE,
                            drug.UNIT_PRICE ?? exist[0].UNIT_PRICE,
                            drug.AMT ?? exist[0].AMT,
                            drug.NOTE1 ?? exist[0].NOTE1,
                            drug.TIME1 ?? exist[0].TIME1,
                            vno, drug.DRUG_CODE
                        ]
                    );
                } else {
                    await connection.execute(`
              INSERT INTO TREATMENT1_DRUG (VNO, DRUG_CODE, QTY, UNIT_CODE, UNIT_PRICE, AMT, NOTE1, TIME1)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [vno, drug.DRUG_CODE, drug.QTY || 1, drug.UNIT_CODE || 'TAB',
                            drug.UNIT_PRICE || 0, drug.AMT || 0, drug.NOTE1 || '', drug.TIME1 || '']
                    );
                }
            }
        }

        // === Procedures ===
        if (req.body.hasOwnProperty('procedures') && Array.isArray(procedures)) {
            for (const proc of procedures) {
                if (!proc.PROC_CODE) continue;
                const [exist] = await connection.execute(
                    `SELECT * FROM TREATMENT1_PROC WHERE VNO=? AND PROC_CODE=?`,
                    [vno, proc.PROC_CODE]
                );
                if (exist.length > 0) {
                    await connection.execute(`
              UPDATE TREATMENT1_PROC
              SET QTY=?, PRICE=?, NOTE1=?
              WHERE VNO=? AND PROC_CODE=?`,
                        [
                            proc.QTY ?? exist[0].QTY,
                            proc.PRICE ?? exist[0].PRICE,
                            proc.NOTE1 ?? exist[0].NOTE1,
                            vno, proc.PROC_CODE
                        ]
                    );
                } else {
                    await connection.execute(`
              INSERT INTO TREATMENT1_PROC (VNO, PROC_CODE, QTY, PRICE, NOTE1)
              VALUES (?, ?, ?, ?, ?)`,
                        [vno, proc.PROC_CODE, proc.QTY || 1, proc.PRICE || 0, proc.NOTE1 || '']
                    );
                }
            }
        }

        // === Lab Tests ===
        if (req.body.hasOwnProperty('labTests') && Array.isArray(labTests)) {
            for (const lab of labTests) {
                if (!lab.LAB_CODE) continue;
                const [exist] = await connection.execute(
                    `SELECT * FROM TREATMENT1_LAB WHERE VNO=? AND LAB_CODE=?`,
                    [vno, lab.LAB_CODE]
                );
                if (exist.length > 0) {
                    await connection.execute(`
              UPDATE TREATMENT1_LAB
              SET RESULT=?, NOTE1=?
              WHERE VNO=? AND LAB_CODE=?`,
                        [
                            lab.RESULT ?? exist[0].RESULT,
                            lab.NOTE1 ?? exist[0].NOTE1,
                            vno, lab.LAB_CODE
                        ]
                    );
                } else {
                    await connection.execute(`
              INSERT INTO TREATMENT1_LAB (VNO, LAB_CODE, RESULT, NOTE1)
              VALUES (?, ?, ?, ?)`,
                        [vno, lab.LAB_CODE, lab.RESULT || '', lab.NOTE1 || '']
                    );
                }
            }
        }

        // === Radio Tests ===
        if (req.body.hasOwnProperty('radioTests') && Array.isArray(radioTests)) {
            for (const radio of radioTests) {
                if (!radio.RADIO_CODE) continue;
                const [exist] = await connection.execute(
                    `SELECT * FROM TREATMENT1_RADIO WHERE VNO=? AND RADIO_CODE=?`,
                    [vno, radio.RADIO_CODE]
                );
                if (exist.length > 0) {
                    await connection.execute(`
              UPDATE TREATMENT1_RADIO
              SET RESULT=?, NOTE1=?
              WHERE VNO=? AND RADIO_CODE=?`,
                        [
                            radio.RESULT ?? exist[0].RESULT,
                            radio.NOTE1 ?? exist[0].NOTE1,
                            vno, radio.RADIO_CODE
                        ]
                    );
                } else {
                    await connection.execute(`
              INSERT INTO TREATMENT1_RADIO (VNO, RADIO_CODE, RESULT, NOTE1)
              VALUES (?, ?, ?, ?)`,
                        [vno, radio.RADIO_CODE, radio.RESULT || '', radio.NOTE1 || '']
                    );
                }
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ', VNO: vno });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`❌ Error updating treatment VNO: ${req.params.vno}`, error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (connection) connection.release();
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
                // ถ้ามีอยู่แล้วก็ส่งกลับว่า success
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
            dateFilter = 'WHERE YEAR(t.PAYMENT_DATE) = YEAR(CURDATE()) AND MONTH(t.PAYMENT_DATE) = MONTH(CURDATE())';
        }

        // สถิติรวม
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

        // รายรับรายวัน
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

        // แยกตามวิธีการชำระเงิน
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



module.exports = router;