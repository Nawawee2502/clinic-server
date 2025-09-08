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
            date_from, date_to, dx_code, icd10_code
        } = req.query;

        // แปลงเป็น integer
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

        const [rows] = await db.execute(`
            SELECT 
                t.VNO, t.HNNO, t.RDATE, t.TRDATE, t.STATUS1,
                t.SYMPTOM, t.TREATMENT1, t.APPOINTMENT_DATE,
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

        // Get total count
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

        // Get diagnosis details
        const [diagnosis] = await db.execute(`
            SELECT * FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?
        `, [vno]);

        // Get drugs
        const [drugs] = await db.execute(`
            SELECT 
                td.*,
                d.GENERIC_NAME, d.TRADE_NAME, d.DOSAGE_FORM, d.STRENGTH1,
                d.ROUTE_ADMIN, d.INDICATION1, d.SIDE_EFFECTS,
                u.UNIT_NAME
            FROM TREATMENT1_DRUG td
            LEFT JOIN TABLE_DRUG d ON td.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON td.UNIT_CODE = u.UNIT_CODE
            WHERE td.VNO = ?
            ORDER BY td.DRUG_CODE
        `, [vno]);

        // Get procedures
        const [procedures] = await db.execute(`
            SELECT 
                tmp.*,
                mp.MED_PRO_NAME_THAI, mp.MED_PRO_NAME_ENG, mp.MED_PRO_TYPE,
                u.UNIT_NAME
            FROM TREATMENT1_MED_PROCEDURE tmp
            LEFT JOIN TABLE_MEDICAL_PROCEDURES mp ON tmp.MEDICAL_PROCEDURE_CODE = mp.MEDICAL_PROCEDURE_CODE
            LEFT JOIN TABLE_UNIT u ON tmp.UNIT_CODE = u.UNIT_CODE
            WHERE tmp.VNO = ?
            ORDER BY tmp.MEDICAL_PROCEDURE_CODE
        `, [vno]);

        // Get lab tests
        const [labTests] = await db.execute(`
            SELECT 
                tl.*,
                l.LABNAME
            FROM TREATMENT1_LABORATORY tl
            LEFT JOIN TABLE_LAB l ON tl.LABCODE = l.LABCODE
            WHERE tl.VNO = ?
            ORDER BY l.LABNAME
        `, [vno]);

        // Get radiological tests
        const [radioTests] = await db.execute(`
            SELECT 
                tr.*,
                r.RLNAME
            FROM TREATMENT1_RADIOLOGICAL tr
            LEFT JOIN TABLE_RADIOLOGICAL r ON tr.RLCODE = r.RLCODE
            WHERE tr.VNO = ?
            ORDER BY r.RLNAME
        `, [vno]);

        // Calculate total cost
        const totalDrugCost = drugs.reduce((sum, drug) => sum + (parseFloat(drug.AMT) || 0), 0);
        const totalProcedureCost = procedures.reduce((sum, proc) => sum + (parseFloat(proc.AMT) || 0), 0);
        const totalCost = totalDrugCost + totalProcedureCost;

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
                    totalCost: totalCost,
                    drugCount: drugs.length,
                    procedureCount: procedures.length,
                    labTestCount: labTests.length,
                    radioTestCount: radioTests.length
                }
            }
        });

    } catch (error) {
        console.error('Error fetching treatment details:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดการรักษา',
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
            labTests = [], radioTests = [], INVESTIGATION_NOTES
        } = req.body;

        console.log(`Updating treatment ${vno}:`, {
            VNO: toNull(VNO),
            HNNO: toNull(HNNO),
            SYMPTOM: toNull(SYMPTOM),
            STATUS1: toNull(STATUS1),
            DXCODE: toNull(DXCODE),
            ICD10CODE: toNull(ICD10CODE),
            TREATMENT1: toNull(TREATMENT1),
            INVESTIGATION_NOTES: toNull(INVESTIGATION_NOTES),
            diagnosis: toNull(diagnosis),
            drugsCount: drugs.length,
            proceduresCount: procedures.length,
            labTestsCount: labTests.length,
            radioTestsCount: radioTests.length
        });

        // Update main treatment
        const [updateResult] = await connection.execute(`
            UPDATE TREATMENT1 SET 
                SYMPTOM = COALESCE(?, SYMPTOM), 
                STATUS1 = COALESCE(?, STATUS1),
                DXCODE = COALESCE(?, DXCODE),
                ICD10CODE = COALESCE(?, ICD10CODE),
                TREATMENT1 = COALESCE(?, TREATMENT1),
                INVESTIGATION_NOTES = COALESCE(?, INVESTIGATION_NOTES)
            WHERE VNO = ?
        `, [
            toNull(SYMPTOM),
            toNull(STATUS1),
            toNull(DXCODE),
            toNull(ICD10CODE),
            toNull(TREATMENT1),
            toNull(INVESTIGATION_NOTES),
            vno
        ]);

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการรักษาที่ต้องการอัปเดต'
            });
        }

        // Update/Insert diagnosis
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

        // Handle drugs  
        if (drugs && Array.isArray(drugs) && drugs.length > 0) {
            await connection.execute(`DELETE FROM TREATMENT1_DRUG WHERE VNO = ?`, [vno]);

            for (const drug of drugs) {
                if (drug.DRUG_CODE) {
                    // ตรวจสอบว่า UNIT_CODE มีอยู่ในฐานข้อมูลหรือไม่
                    let unitCode = toNull(drug.UNIT_CODE) || 'TAB';

                    const [unitExists] = await connection.execute(
                        'SELECT UNIT_CODE FROM TABLE_UNIT WHERE UNIT_CODE = ?',
                        [unitCode]
                    );

                    // ถ้าไม่มี ให้ใช้ TAB แทน
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
                        unitCode, // ← ใช้ unit code ที่ตรวจสอบแล้ว
                        toNull(drug.UNIT_PRICE) || 0,
                        toNull(drug.AMT) || 0,
                        toNull(drug.NOTE1) || '',
                        toNull(drug.TIME1) || ''
                    ]);
                }
            }
        }

        // Handle procedures - ปรับปรุงให้รองรับ freestyle procedures
        if (procedures && Array.isArray(procedures) && procedures.length > 0) {
            await connection.execute(`DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?`, [vno]);

            for (const proc of procedures) {
                let procedureCode = toNull(proc.PROCEDURE_CODE) || toNull(proc.MEDICAL_PROCEDURE_CODE);
                const procedureName = toNull(proc.PROCEDURE_NAME) || 'หัตถการที่ไม่ระบุชื่อ';

                if (procedureCode) {
                    // ตัดรหัสให้สั้นลงถ้ายาวเกินไป
                    if (procedureCode.length > 15) {
                        procedureCode = procedureCode.substring(0, 15);
                    }

                    // ตรวจสอบและเตรียม UNIT_CODE ให้ถูกต้อง
                    let unitCode = toNull(proc.UNIT_CODE) || 'TIMES';

                    // ตรวจสอบว่า unit code มีอยู่จริงหรือไม่
                    const [unitExists] = await connection.execute(
                        'SELECT UNIT_CODE FROM TABLE_UNIT WHERE UNIT_CODE = ?',
                        [unitCode]
                    );

                    // ถ้าไม่มี ให้ใช้ unit code ที่มีอยู่แล้ว
                    if (unitExists.length === 0) {
                        try {
                            await connection.execute(
                                'INSERT INTO TABLE_UNIT (UNIT_CODE, UNIT_NAME) VALUES (?, ?)',
                                [unitCode, 'ครั้ง']
                            );
                            console.log(`Added new unit: ${unitCode}`);
                        } catch (unitError) {
                            // ถ้าเพิ่มไม่ได้ ให้ใช้ unit code ที่มีอยู่แล้ว
                            const [firstUnit] = await connection.execute(
                                'SELECT UNIT_CODE FROM TABLE_UNIT LIMIT 1'
                            );
                            unitCode = firstUnit.length > 0 ? firstUnit[0].UNIT_CODE : 'PC';
                            console.log(`Using existing unit: ${unitCode}`);
                        }
                    }

                    // ตรวจสอบและเพิ่มหัตถการใหม่หากจำเป็น
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

                        // ถ้ายังเกิด error ให้สร้างรหัสใหม่ที่สั้นกว่า
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
                            throw procError; // re-throw ถ้าเป็น error อื่น
                        }
                    }
                }
            }
        }

        // Handle lab tests
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

        // Handle radiological tests
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
            message: 'อัปเดตข้อมูลการรักษาสำเร็จ',
            data: {
                VNO: vno,
                updatedItems: {
                    drugs: drugs.length,
                    procedures: procedures.length,
                    labTests: labTests.length,
                    radioTests: radioTests.length,
                    investigationNotes: INVESTIGATION_NOTES ? 'updated' : 'no change'
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

        console.error('Error updating treatment:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการรักษา',
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



module.exports = router;