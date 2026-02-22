const express = require('express');
const router = express.Router();
const dbPoolPromise = require('../config/db');
const { ensureHNSequenceInfrastructure, generateNextHN } = require('../utils/hnSequence');

// GET all patients with pagination
router.get('/', async (req, res) => {
    let connection = null;
    try {
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();

        // Pagination parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50)); // Default 50, max 100
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await connection.query('SELECT COUNT(*) as total FROM patient1');
        const total = countResult[0].total;

        // Get paginated data
        const [rows] = await connection.query(`
      SELECT 
        p.*,
        prov.PROVINCE_NAME,
        amp.AMPHER_NAME,
        tumb.TUMBOL_NAME,
        card_prov.PROVINCE_NAME AS CARD_PROVINCE_NAME,
        card_amp.AMPHER_NAME AS CARD_AMPHER_NAME,
        card_tumb.TUMBOL_NAME AS CARD_TUMBOL_NAME
      FROM patient1 p
      LEFT JOIN province prov ON p.PROVINCE_CODE = prov.PROVINCE_CODE
      LEFT JOIN ampher amp ON p.AMPHER_CODE = amp.AMPHER_CODE
      LEFT JOIN tumbol tumb ON p.TUMBOL_CODE = tumb.TUMBOL_CODE
      LEFT JOIN province card_prov ON p.CARD_PROVINCE_CODE = card_prov.PROVINCE_CODE
      LEFT JOIN ampher card_amp ON p.CARD_AMPHER_CODE = card_amp.AMPHER_CODE
      LEFT JOIN tumbol card_tumb ON p.CARD_TUMBOL_CODE = card_tumb.TUMBOL_CODE
      ORDER BY p.HNCODE
      LIMIT ? OFFSET ?
    `, [limit, offset]);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// GET check ID card duplicate
router.get('/check-idcard/:idno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { idno } = req.params;

        const [rows] = await db.execute(
            'SELECT HNCODE, NAME1, SURNAME, IDNO FROM patient1 WHERE IDNO = ?',
            [idno]
        );

        if (rows.length > 0) {
            res.json({
                success: true,
                exists: true,
                patient: rows[0]
            });
        } else {
            res.json({
                success: true,
                exists: false
            });
        }
    } catch (error) {
        console.error('Error checking ID card:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบบัตรประชาชน',
            error: error.message
        });
    }
});

// GET check HN duplicate
router.get('/check-hn/:hn', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { hn } = req.params;

        const [rows] = await db.execute(
            'SELECT HNCODE, PRENAME, NAME1, SURNAME, IDNO FROM patient1 WHERE HNCODE = ?',
            [hn]
        );

        if (rows.length > 0) {
            res.json({
                success: true,
                exists: true,
                patient: rows[0]
            });
        } else {
            res.json({
                success: true,
                exists: false
            });
        }
    } catch (error) {
        console.error('Error checking HN:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบ HN',
            error: error.message
        });
    }
});

// GET patient by HN
router.get('/:hn', async (req, res) => {
    let connection = null;
    try {
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();
        const { hn } = req.params;
        const [rows] = await connection.query(`
      SELECT 
        p.*,
        prov.PROVINCE_NAME,
        amp.AMPHER_NAME,
        tumb.TUMBOL_NAME,
        card_prov.PROVINCE_NAME as CARD_PROVINCE_NAME,
        card_amp.AMPHER_NAME as CARD_AMPHER_NAME,
        card_tumb.TUMBOL_NAME as CARD_TUMBOL_NAME
      FROM patient1 p
      LEFT JOIN province prov ON p.PROVINCE_CODE = prov.PROVINCE_CODE
      LEFT JOIN ampher amp ON p.AMPHER_CODE = amp.AMPHER_CODE
      LEFT JOIN tumbol tumb ON p.TUMBOL_CODE = tumb.TUMBOL_CODE
      LEFT JOIN province card_prov ON p.CARD_PROVINCE_CODE = card_prov.PROVINCE_CODE
      LEFT JOIN ampher card_amp ON p.CARD_AMPHER_CODE = card_amp.AMPHER_CODE
      LEFT JOIN tumbol card_tumb ON p.CARD_TUMBOL_CODE = card_tumb.TUMBOL_CODE
      WHERE p.HNCODE = ?
    `, [hn]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้ป่วย'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching patient:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Search patients by name or HN - ดึงข้อมูลครบเหมือน GET by HN
router.get('/search/:term', async (req, res) => {
    let connection = null;
    try {
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        // แยกคำค้นหาเป็น array (สำหรับค้นหาชื่อเต็ม)
        const searchWords = term.trim().split(/\s+/).filter(word => word.length > 0);
        const searchConditions = [];
        const searchParams = [];

        // ค้นหาในแต่ละ field
        searchConditions.push('p.HNCODE LIKE ?');
        searchParams.push(searchTerm);

        searchConditions.push('p.IDNO LIKE ?');
        searchParams.push(searchTerm);

        searchConditions.push('p.NAME1 LIKE ?');
        searchParams.push(searchTerm);

        searchConditions.push('p.SURNAME LIKE ?');
        searchParams.push(searchTerm);

        // ค้นหาชื่อเต็ม (CONCAT NAME1 และ SURNAME)
        searchConditions.push('CONCAT(COALESCE(p.NAME1, ""), " ", COALESCE(p.SURNAME, "")) LIKE ?');
        searchParams.push(searchTerm);

        // ค้นหาชื่อเต็มแบบ reverse (SURNAME + NAME1)
        searchConditions.push('CONCAT(COALESCE(p.SURNAME, ""), " ", COALESCE(p.NAME1, "")) LIKE ?');
        searchParams.push(searchTerm);

        // ถ้ามีหลายคำ ให้ค้นหาทั้งชื่อและนามสกุล (เช่น "มงคล มาลาพุด")
        if (searchWords.length >= 2) {
            // ค้นหาที่ชื่อมีคำแรก และนามสกุลมีคำที่สอง
            searchConditions.push('(p.NAME1 LIKE ? AND p.SURNAME LIKE ?)');
            searchParams.push(`%${searchWords[0]}%`);
            searchParams.push(`%${searchWords[searchWords.length - 1]}%`);
        }

        // Create full count query to calculate total pages
        const [countResult] = await connection.query(`
            SELECT COUNT(*) as total 
            FROM patient1 p 
            WHERE ${searchConditions.join(' OR ')}
        `, searchParams);
        const total = countResult[0].total;

        // Pagination parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        // ดึงข้อมูลครบเหมือน GET by HN พร้อม Pagination
        const [rows] = await connection.query(`
      SELECT 
        p.*,
        prov.PROVINCE_NAME,
        amp.AMPHER_NAME,
        tumb.TUMBOL_NAME,
        card_prov.PROVINCE_NAME as CARD_PROVINCE_NAME,
        card_amp.AMPHER_NAME as CARD_AMPHER_NAME,
        card_tumb.TUMBOL_NAME as CARD_TUMBOL_NAME
      FROM patient1 p
      LEFT JOIN province prov ON p.PROVINCE_CODE = prov.PROVINCE_CODE
      LEFT JOIN ampher amp ON p.AMPHER_CODE = amp.AMPHER_CODE
      LEFT JOIN tumbol tumb ON p.TUMBOL_CODE = tumb.TUMBOL_CODE
      LEFT JOIN province card_prov ON p.CARD_PROVINCE_CODE = card_prov.PROVINCE_CODE
      LEFT JOIN ampher card_amp ON p.CARD_AMPHER_CODE = card_amp.AMPHER_CODE
      LEFT JOIN tumbol card_tumb ON p.CARD_TUMBOL_CODE = card_tumb.TUMBOL_CODE
      WHERE ${searchConditions.join(' OR ')}
      ORDER BY p.HNCODE
      LIMIT ? OFFSET ?
    `, [...searchParams, limit, offset]);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching patients:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลผู้ป่วย',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// GET patients by province
router.get('/province/:provinceCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { provinceCode } = req.params;
        const [rows] = await db.execute(`
      SELECT 
        p.HNCODE, p.IDNO, p.PRENAME, p.NAME1, p.SURNAME, 
        p.SEX, p.AGE, p.BDATE, p.TEL1,
        prov.PROVINCE_NAME,
        amp.AMPHER_NAME,
        tumb.TUMBOL_NAME
      FROM patient1 p
      LEFT JOIN province prov ON p.PROVINCE_CODE = prov.PROVINCE_CODE
      LEFT JOIN ampher amp ON p.AMPHER_CODE = amp.AMPHER_CODE
      LEFT JOIN tumbol tumb ON p.TUMBOL_CODE = tumb.TUMBOL_CODE
      WHERE p.PROVINCE_CODE = ?
      ORDER BY p.HNCODE
      LIMIT 100
    `, [provinceCode]);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching patients by province:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วยตามจังหวัด',
            error: error.message
        });
    }
});

// GET simple statistics
router.get('/stats/basic', async (req, res) => {
    try {
        const db = await require('../config/db');

        const [totalCount] = await db.execute('SELECT COUNT(*) as total FROM patient1');

        const [genderStats] = await db.execute(`
      SELECT SEX, COUNT(*) as count 
      FROM patient1 
      WHERE SEX IS NOT NULL AND SEX != ''
      GROUP BY SEX
    `);

        const [ageGroups] = await db.execute(`
      SELECT 
        CASE 
          WHEN AGE BETWEEN 0 AND 17 THEN 'เด็กและวัยรุ่น (0-17)'
          WHEN AGE BETWEEN 18 AND 59 THEN 'ผู้ใหญ่ (18-59)'
          WHEN AGE >= 60 THEN 'ผู้สูงอายุ (60+)'
          ELSE 'ไม่ระบุ'
        END as age_group,
        COUNT(*) as count
      FROM patient1
      GROUP BY age_group
    `);

        res.json({
            success: true,
            data: {
                totalPatients: totalCount[0].total,
                genderDistribution: genderStats,
                ageGroups: ageGroups,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching patient statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติข้อมูลผู้ป่วย',
            error: error.message
        });
    }
});

// POST create new patient
router.post('/', async (req, res) => {
    let connection;
    try {
        await ensureHNSequenceInfrastructure();
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const {
            HNCODE, IDNO, PRENAME, NAME1, SURNAME, SEX, BDATE, AGE,
            BLOOD_GROUP1, OCCUPATION1, ORIGIN1, NATIONAL1, RELIGION1, STATUS1,
            WEIGHT1, HIGH1, CARD_ADDR1, CARD_TUMBOL_CODE, CARD_AMPHER_CODE,
            CARD_PROVINCE_CODE, ADDR1, TUMBOL_CODE, AMPHER_CODE, PROVINCE_CODE,
            ZIPCODE, TEL1, EMAIL1, DISEASE1, DRUG_ALLERGY, FOOD_ALLERGIES,
            TREATMENT_CARD, SOCIAL_CARD, UCS_CARD, ID_TYPE
        } = req.body;

        if (!NAME1) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อ'
            });
        }

        const normalizedIdNo = IDNO ? IDNO.trim() : null;
        if (normalizedIdNo) {
            const [idRows] = await connection.query(
                `
                SELECT HNCODE, NAME1, SURNAME 
                FROM patient1 
                WHERE IDNO = ? 
                LIMIT 1 FOR UPDATE
                `,
                [normalizedIdNo]
            );

            if (idRows.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    code: 'DUPLICATE_IDNO',
                    message: 'เลขบัตรประชาชนนี้มีอยู่แล้วในระบบ',
                    data: idRows[0]
                });
            }
        }

        let hnToUse = HNCODE ? HNCODE.trim() : '';

        // 🔁 พยายามสร้าง HN ใหม่จนกว่าจะสำเร็จ (ปล่อยให้ loop จัดการกรณีซ้ำ)
        // ใช้ sequence บนฐานข้อมูลเพื่อป้องกันปัญหา race condition
        // หากเกิดข้อผิดพลาดอื่นที่ไม่ใช่รหัสซ้ำ จะ throw ออกไปให้ catch ด้านนอกจัดการ
        // (ป้องกันการสร้าง HN ซ้ำแบบถาวร)
        while (true) {
            if (hnToUse) {
                const [existingHNRows] = await connection.query(
                    `
                    SELECT HNCODE 
                    FROM patient1 
                    WHERE HNCODE = ? 
                    LIMIT 1 FOR UPDATE
                    `,
                    [hnToUse]
                );

                if (existingHNRows.length > 0) {
                    hnToUse = '';
                }
            }

            if (!hnToUse) {
                hnToUse = await generateNextHN(connection);
            }

            try {
                await connection.query(`
            INSERT INTO patient1 (
              HNCODE, IDNO, PRENAME, NAME1, SURNAME, SEX, BDATE, AGE,
              BLOOD_GROUP1, OCCUPATION1, ORIGIN1, NATIONAL1, RELIGION1, STATUS1,
              WEIGHT1, HIGH1, CARD_ADDR1, CARD_TUMBOL_CODE, CARD_AMPHER_CODE,
              CARD_PROVINCE_CODE, ADDR1, TUMBOL_CODE, AMPHER_CODE, PROVINCE_CODE,
              ZIPCODE, TEL1, EMAIL1, DISEASE1, DRUG_ALLERGY, FOOD_ALLERGIES,
              TREATMENT_CARD, SOCIAL_CARD, UCS_CARD, ID_TYPE, REGDATE
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
          `, [
                    hnToUse, IDNO, PRENAME, NAME1, SURNAME, SEX, BDATE, AGE,
                    BLOOD_GROUP1, OCCUPATION1, ORIGIN1, NATIONAL1, RELIGION1, STATUS1,
                    WEIGHT1, HIGH1, CARD_ADDR1, CARD_TUMBOL_CODE, CARD_AMPHER_CODE,
                    CARD_PROVINCE_CODE, ADDR1, TUMBOL_CODE, AMPHER_CODE, PROVINCE_CODE,
                    ZIPCODE, TEL1, EMAIL1, DISEASE1, DRUG_ALLERGY, FOOD_ALLERGIES,
                    TREATMENT_CARD, SOCIAL_CARD, UCS_CARD, ID_TYPE || 'IDCARD'
                ]);

                await connection.commit();

                return res.status(201).json({
                    success: true,
                    message: 'เพิ่มข้อมูลผู้ป่วยสำเร็จ',
                    data: {
                        HNCODE: hnToUse,
                        NAME1,
                        SURNAME,
                        fullName: `${PRENAME || ''} ${NAME1} ${SURNAME || ''}`.trim()
                    }
                });
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    hnToUse = '';
                    continue;
                }
                throw error;
            }
        }
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        console.error('Error creating patient:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'รหัส HN นี้มีอยู่แล้ว'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลผู้ป่วย',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// PUT update patient
router.put('/:hn', async (req, res) => {
    let connection = null;
    try {
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { hn } = req.params;
        const {
            IDNO, PRENAME, NAME1, SURNAME, SEX, BDATE, AGE,
            BLOOD_GROUP1, OCCUPATION1, ORIGIN1, NATIONAL1, RELIGION1, STATUS1,
            WEIGHT1, HIGH1, CARD_ADDR1, CARD_TUMBOL_CODE, CARD_AMPHER_CODE,
            CARD_PROVINCE_CODE, ADDR1, TUMBOL_CODE, AMPHER_CODE, PROVINCE_CODE,
            ZIPCODE, TEL1, EMAIL1, DISEASE1, DRUG_ALLERGY, FOOD_ALLERGIES,
            TREATMENT_CARD, SOCIAL_CARD, UCS_CARD, ID_TYPE
        } = req.body;

        // Validate required fields
        if (!NAME1 || NAME1.trim() === '') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อ'
            });
        }

        // Check if patient exists
        const [existingPatient] = await connection.execute(
            'SELECT HNCODE FROM patient1 WHERE HNCODE = ?',
            [hn]
        );

        if (existingPatient.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้ป่วยที่ต้องการแก้ไข'
            });
        }

        // Check for duplicate IDNO if provided
        const normalizedIdNo = IDNO ? IDNO.trim() : null;
        if (normalizedIdNo) {
            const [idRows] = await connection.execute(
                'SELECT HNCODE FROM patient1 WHERE IDNO = ? AND HNCODE != ?',
                [normalizedIdNo, hn]
            );

            if (idRows.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: 'เลขบัตรประชาชนนี้มีอยู่แล้วในระบบ',
                    code: 'DUPLICATE_IDNO'
                });
            }
        }

        const [result] = await connection.query(`
      UPDATE patient1 SET 
        IDNO = ?, PRENAME = ?, NAME1 = ?, SURNAME = ?, SEX = ?, BDATE = ?, AGE = ?,
        BLOOD_GROUP1 = ?, OCCUPATION1 = ?, ORIGIN1 = ?, NATIONAL1 = ?, RELIGION1 = ?, STATUS1 = ?,
        WEIGHT1 = ?, HIGH1 = ?, CARD_ADDR1 = ?, CARD_TUMBOL_CODE = ?, CARD_AMPHER_CODE = ?,
        CARD_PROVINCE_CODE = ?, ADDR1 = ?, TUMBOL_CODE = ?, AMPHER_CODE = ?, PROVINCE_CODE = ?,
        ZIPCODE = ?, TEL1 = ?, EMAIL1 = ?, DISEASE1 = ?, DRUG_ALLERGY = ?, FOOD_ALLERGIES = ?,
        TREATMENT_CARD = ?, SOCIAL_CARD = ?, UCS_CARD = ?, ID_TYPE = ?
      WHERE HNCODE = ?
    `, [
            IDNO, PRENAME, NAME1, SURNAME, SEX, BDATE, AGE,
            BLOOD_GROUP1, OCCUPATION1, ORIGIN1, NATIONAL1, RELIGION1, STATUS1,
            WEIGHT1, HIGH1, CARD_ADDR1, CARD_TUMBOL_CODE, CARD_AMPHER_CODE,
            CARD_PROVINCE_CODE, ADDR1, TUMBOL_CODE, AMPHER_CODE, PROVINCE_CODE,
            ZIPCODE, TEL1, EMAIL1, DISEASE1, DRUG_ALLERGY, FOOD_ALLERGIES,
            TREATMENT_CARD, SOCIAL_CARD, UCS_CARD, ID_TYPE || 'IDCARD', hn
        ]);

        // Note: result.affectedRows might be 0 if the data hasn't changed. 
        // Since we already verified the patient exists (lines 523-534), we can treat this as success.

        if (result.affectedRows === 0) {
            console.log('Update successful but no data changed for HN:', hn);
            // Proceed to commit and return success
        }

        await connection.commit();
        connection.release();

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลผู้ป่วยสำเร็จ',
            data: {
                HNCODE: hn,
                NAME1,
                SURNAME,
                fullName: `${PRENAME || ''} ${NAME1} ${SURNAME || ''}`.trim()
            }
        });
    } catch (error) {
        // Ensure connection is released even if rollback fails
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            } finally {
                try {
                    connection.release();
                } catch (releaseError) {
                    console.error('Error releasing connection:', releaseError);
                }
            }
        }

        console.error('Error updating patient:', error);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            errno: error.errno
        });

        // Prevent server crash by always sending response
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ป่วย',
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? {
                    code: error.code,
                    sqlState: error.sqlState,
                    sqlMessage: error.sqlMessage
                } : undefined
            });
        }
    }
});

// DELETE patient
router.delete('/:hn', async (req, res) => {
    const db = await require('../config/db');
    let connection = null;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { hn } = req.params;

        // ตรวจสอบว่ามีข้อมูลผู้ป่วยหรือไม่
        const [patientCheck] = await connection.execute(
            'SELECT HNCODE FROM patient1 WHERE HNCODE = ?',
            [hn]
        );

        if (patientCheck.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้ป่วยที่ต้องการลบ'
            });
        }

        // ดึง VNO ทั้งหมดที่เกี่ยวข้องกับ HN นี้
        const [treatments] = await connection.execute(
            'SELECT VNO FROM TREATMENT1 WHERE HNNO = ?',
            [hn]
        );

        const vnoList = treatments.map(t => t.VNO);
        const treatmentCount = vnoList.length;

        // นับจำนวน DAILY_QUEUE ที่เกี่ยวข้อง
        const [queueCount] = await connection.execute(
            'SELECT COUNT(*) as count FROM DAILY_QUEUE WHERE HNCODE = ?',
            [hn]
        );
        const queueCountNum = queueCount[0]?.count || 0;

        // นับจำนวน APPOINTMENT_SCHEDULE ที่เกี่ยวข้อง
        const [appointmentCount] = await connection.execute(
            'SELECT COUNT(*) as count FROM APPOINTMENT_SCHEDULE WHERE HNCODE = ?',
            [hn]
        );
        const appointmentCountNum = appointmentCount[0]?.count || 0;

        // ลบข้อมูลที่เกี่ยวข้องกับ TREATMENT1 ทั้งหมด
        if (vnoList.length > 0) {
            // ลบข้อมูลในตารางที่เกี่ยวข้อง
            const placeholders = vnoList.map(() => '?').join(',');

            await connection.execute(
                `DELETE FROM TREATMENT1_DIAGNOSIS WHERE VNO IN (${placeholders})`,
                vnoList
            );

            await connection.execute(
                `DELETE FROM TREATMENT1_DRUG WHERE VNO IN (${placeholders})`,
                vnoList
            );

            await connection.execute(
                `DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO IN (${placeholders})`,
                vnoList
            );

            await connection.execute(
                `DELETE FROM TREATMENT1_LABORATORY WHERE VNO IN (${placeholders})`,
                vnoList
            );

            await connection.execute(
                `DELETE FROM TREATMENT1_RADIOLOGICAL WHERE VNO IN (${placeholders})`,
                vnoList
            );
        }

        // ลบข้อมูล TREATMENT1 ที่เกี่ยวข้องกับ HN
        await connection.execute('DELETE FROM TREATMENT1 WHERE HNNO = ?', [hn]);

        // ลบข้อมูล DAILY_QUEUE ที่เกี่ยวข้องกับ HN
        await connection.execute('DELETE FROM DAILY_QUEUE WHERE HNCODE = ?', [hn]);

        // ลบข้อมูล APPOINTMENT_SCHEDULE ที่เกี่ยวข้องกับ HN
        await connection.execute('DELETE FROM APPOINTMENT_SCHEDULE WHERE HNCODE = ?', [hn]);

        // ลบข้อมูลจากตารางอื่นๆ ที่อาจจะเกี่ยวข้องกับ HN
        // ตรวจสอบและลบจากตารางที่อาจจะมี HNCODE หรือ HNNO
        const tablesToCheck = [
            'INCOME1',
            'PAY1',
            'RECEIPT1',
            'RETURN1',
            'INVOICE1',
            'BILL1'
        ];

        for (const tableName of tablesToCheck) {
            try {
                // ตรวจสอบว่าตารางมีอยู่และมีฟิลด์ HNCODE หรือ HNNO หรือไม่
                const [columns] = await connection.execute(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = ? 
                    AND COLUMN_NAME IN ('HNCODE', 'HNNO')
                `, [tableName]);

                if (columns.length > 0) {
                    const columnNames = columns.map(c => c.COLUMN_NAME);
                    const conditions = columnNames.map(col => `${col} = ?`).join(' OR ');
                    const values = columnNames.map(() => hn);

                    const [deleteResult] = await connection.execute(
                        `DELETE FROM ${tableName} WHERE ${conditions}`,
                        values
                    );

                    if (deleteResult.affectedRows > 0) {
                        console.log(`✅ Deleted ${deleteResult.affectedRows} record(s) from ${tableName} where ${conditions}`);
                    }
                }
            } catch (error) {
                // ถ้าตารางไม่มีหรือไม่มีฟิลด์นี้ จะข้ามไป
                console.log(`⚠️ ${tableName} table may not exist or may not have HNCODE/HNNO field, skipping...`);
            }
        }

        // ลบข้อมูลผู้ป่วย
        const [result] = await connection.execute('DELETE FROM patient1 WHERE HNCODE = ?', [hn]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้ป่วยที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบข้อมูลผู้ป่วยและข้อมูลที่เกี่ยวข้องสำเร็จ',
            data: {
                HNCODE: hn,
                deletedTreatments: treatmentCount,
                deletedQueues: queueCountNum,
                deletedAppointments: appointmentCountNum,
                summary: {
                    treatments: treatmentCount,
                    queues: queueCountNum,
                    appointments: appointmentCountNum,
                    total: treatmentCount + queueCountNum + appointmentCountNum
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

        console.error('Error deleting patient:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลผู้ป่วย',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;