const express = require('express');
const router = express.Router();

// const ensureProcedureExists = async (connection, procedureCode, procedureName) => {
//     try {
//         // ตัดรหัสให้สั้นลงถ้ายาวเกินไป
//         if (procedureCode.length > 15) {
//             procedureCode = procedureCode.substring(0, 15);
//         }

//         // ตรวจสอบว่ามีหัตถการนี้อยู่หรือไม่
//         const [existing] = await connection.execute(
//             'SELECT MEDICAL_PROCEDURE_CODE FROM TABLE_MEDICAL_PROCEDURES WHERE MEDICAL_PROCEDURE_CODE = ?',
//             [procedureCode]
//         );

//         if (existing.length === 0) {
//             // ถ้าไม่มี ให้เพิ่มใหม่
//             await connection.execute(`
//                 INSERT INTO TABLE_MEDICAL_PROCEDURES 
//                 (MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE) 
//                 VALUES (?, ?, ?, 'Custom', 0)
//             `, [procedureCode, procedureName.substring(0, 255), procedureName.substring(0, 255)]);

//             console.log(`Added new procedure: ${procedureCode} - ${procedureName}`);
//         }
//     } catch (error) {
//         console.error('Error ensuring procedure exists:', error);
//         // ไม่ throw error เพื่อไม่ให้กระทบการทำงาน
//     }
// };

const ensureProcedureExists = async (connection, procedureCode, procedureName) => {
    try {
        // ป้องกัน null/undefined
        let code = (procedureCode || '').toString();
        let name = (procedureName || '').toString();

        // ตัดรหัสให้สั้นลงถ้ายาวเกินไป
        if (code.length > 15) {
            code = code.substring(0, 15);
        }

        // ตรวจสอบว่ามีหัตถการนี้อยู่หรือไม่
        const [existing] = await connection.execute(
            'SELECT MEDICAL_PROCEDURE_CODE FROM TABLE_MEDICAL_PROCEDURES WHERE MEDICAL_PROCEDURE_CODE = ? LIMIT 1',
            [code]
        );

        if (existing.length === 0) {
            // ถ้าไม่มี ให้เพิ่มใหม่
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
        // ไม่ throw error เพื่อไม่ให้กระทบการทำงานหลัก
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

// PUT update entire treatment
// router.put('/:vno', async (req, res) => {
//     const db = await require('../config/db');
//     let connection = null;

//     try {
//         connection = await db.getConnection();
//         await connection.beginTransaction();

//         const { vno } = req.params;
//         const {
//             STATUS1, SYMPTOM, DXCODE, ICD10CODE, TREATMENT1, INVESTIGATION_NOTES,
//             // Payment fields
//             TOTAL_AMOUNT, DISCOUNT_AMOUNT, NET_AMOUNT, PAYMENT_STATUS,
//             PAYMENT_DATE, PAYMENT_TIME, PAYMENT_METHOD, RECEIVED_AMOUNT,
//             CHANGE_AMOUNT, CASHIER,
//             // Related data
//             diagnosis, drugs = [], procedures = [], labTests = [], radioTests = []
//         } = req.body;

//         // สร้าง dynamic update query
//         const updateFields = [];
//         const updateValues = [];

//         if (STATUS1 !== undefined) {
//             updateFields.push('STATUS1 = ?');
//             updateValues.push(STATUS1);
//         }
//         if (SYMPTOM !== undefined) {
//             updateFields.push('SYMPTOM = ?');
//             updateValues.push(SYMPTOM);
//         }
//         if (DXCODE !== undefined) {
//             updateFields.push('DXCODE = ?');
//             updateValues.push(DXCODE);
//         }
//         if (ICD10CODE !== undefined) {
//             updateFields.push('ICD10CODE = ?');
//             updateValues.push(ICD10CODE);
//         }
//         if (TREATMENT1 !== undefined) {
//             updateFields.push('TREATMENT1 = ?');
//             updateValues.push(TREATMENT1);
//         }
//         if (INVESTIGATION_NOTES !== undefined) {
//             updateFields.push('INVESTIGATION_NOTES = ?');
//             updateValues.push(INVESTIGATION_NOTES);
//         }

//         // Payment fields
//         if (TOTAL_AMOUNT !== undefined) {
//             updateFields.push('TOTAL_AMOUNT = ?');
//             updateValues.push(parseFloat(TOTAL_AMOUNT) || 0);
//         }
//         if (DISCOUNT_AMOUNT !== undefined) {
//             updateFields.push('DISCOUNT_AMOUNT = ?');
//             updateValues.push(parseFloat(DISCOUNT_AMOUNT) || 0);
//         }
//         if (NET_AMOUNT !== undefined) {
//             updateFields.push('NET_AMOUNT = ?');
//             updateValues.push(parseFloat(NET_AMOUNT) || 0);
//         }
//         if (PAYMENT_STATUS !== undefined) {
//             updateFields.push('PAYMENT_STATUS = ?');
//             updateValues.push(PAYMENT_STATUS);
//         }
//         if (PAYMENT_DATE !== undefined) {
//             updateFields.push('PAYMENT_DATE = ?');
//             updateValues.push(PAYMENT_DATE);
//         }
//         if (PAYMENT_TIME !== undefined) {
//             updateFields.push('PAYMENT_TIME = ?');
//             updateValues.push(PAYMENT_TIME);
//         }
//         if (PAYMENT_METHOD !== undefined) {
//             updateFields.push('PAYMENT_METHOD = ?');
//             updateValues.push(PAYMENT_METHOD);
//         }
//         if (RECEIVED_AMOUNT !== undefined) {
//             updateFields.push('RECEIVED_AMOUNT = ?');
//             updateValues.push(parseFloat(RECEIVED_AMOUNT) || 0);
//         }
//         if (CHANGE_AMOUNT !== undefined) {
//             updateFields.push('CHANGE_AMOUNT = ?');
//             updateValues.push(parseFloat(CHANGE_AMOUNT) || 0);
//         }
//         if (CASHIER !== undefined) {
//             updateFields.push('CASHIER = ?');
//             updateValues.push(CASHIER);
//         }

//         if (updateFields.length > 0) {
//             updateValues.push(vno);

//             const [updateResult] = await connection.execute(`
//                 UPDATE TREATMENT1 SET ${updateFields.join(', ')} WHERE VNO = ?
//             `, updateValues);

//             if (updateResult.affectedRows === 0) {
//                 await connection.rollback();
//                 return res.status(404).json({
//                     success: false,
//                     message: 'ไม่พบข้อมูลการรักษาที่ต้องการอัปเดต'
//                 });
//             }
//         }

//         await connection.commit();

//         res.json({
//             success: true,
//             message: 'อัปเดตข้อมูลการรักษาสำเร็จ',
//             data: { VNO: vno }
//         });

//     } catch (error) {
//         if (connection) {
//             await connection.rollback();
//         }
//         console.error('Error updating treatment:', error);
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
// PUT update entire treatment (TREATMENT1 + diagnosis + drugs + procedures + labTests + radioTests)

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
            WEIGHT1, HIGHT1, BT1, PR1, RR1, BP1, BP2, SPO2
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
        // Update main treatment พร้อม vitalsign
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
                BP2 = COALESCE(?, BP2),   -- 👈 เพิ่ม
                SPO2 = COALESCE(?, SPO2)  -- 👈 เพิ่ม
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
            toNull(BP2),   // 👈 เพิ่ม
            toNull(SPO2),  // 👈 เพิ่ม
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