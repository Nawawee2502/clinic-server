const express = require('express');
const router = express.Router();
const dbPoolPromise = require('../config/db');
const { ensureHNSequenceInfrastructure, generateNextHN } = require('../utils/hnSequence');

const safeString = (value, defaultValue = '') => {
    if (value === undefined || value === null) {
        return defaultValue;
    }

    const trimmed = String(value).trim();
    return trimmed === '' ? defaultValue : trimmed;
};

const safeNumber = (value, defaultValue = 0) => {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : defaultValue;
};

const preparePatientInsertData = (data = {}) => {
    const defaults = {
        HNCODE: '',
        IDNO: '',
        PRENAME: '',
        NAME1: '',
        SURNAME: '',
        SEX: '',
        BDATE: '',
        AGE: 0,
        BLOOD_GROUP1: '',
        OCCUPATION1: '',
        ORIGIN1: 'ไทย',
        NATIONAL1: 'ไทย',
        RELIGION1: 'พุทธ',
        STATUS1: 'โสด',
        WEIGHT1: 0,
        HIGH1: 0,
        CARD_ADDR1: '',
        CARD_TUMBOL_CODE: '',
        CARD_AMPHER_CODE: '',
        CARD_PROVINCE_CODE: '',
        ADDR1: '',
        TUMBOL_CODE: '',
        AMPHER_CODE: '',
        PROVINCE_CODE: '',
        ZIPCODE: '',
        TEL1: '',
        EMAIL1: '',
        DISEASE1: '',
        DRUG_ALLERGY: '',
        FOOD_ALLERGIES: '',
        SOCIAL_CARD: 'N',
        UCS_CARD: 'N'
    };

    const merged = { ...defaults, ...data };

    return {
        HNCODE: safeString(merged.HNCODE, ''),
        IDNO: safeString(merged.IDNO, ''),
        PRENAME: safeString(merged.PRENAME, ''),
        NAME1: safeString(merged.NAME1, ''),
        SURNAME: safeString(merged.SURNAME, ''),
        SEX: safeString(merged.SEX, ''),
        BDATE: safeString(merged.BDATE, ''),
        AGE: safeNumber(merged.AGE, 0),
        BLOOD_GROUP1: safeString(merged.BLOOD_GROUP1, ''),
        OCCUPATION1: safeString(merged.OCCUPATION1, ''),
        ORIGIN1: safeString(merged.ORIGIN1, 'ไทย'),
        NATIONAL1: safeString(merged.NATIONAL1, 'ไทย'),
        RELIGION1: safeString(merged.RELIGION1, 'พุทธ'),
        STATUS1: safeString(merged.STATUS1, 'โสด'),
        WEIGHT1: safeNumber(merged.WEIGHT1, 0),
        HIGH1: safeNumber(merged.HIGH1, 0),
        CARD_ADDR1: safeString(merged.CARD_ADDR1, ''),
        CARD_TUMBOL_CODE: safeString(merged.CARD_TUMBOL_CODE, ''),
        CARD_AMPHER_CODE: safeString(merged.CARD_AMPHER_CODE, ''),
        CARD_PROVINCE_CODE: safeString(merged.CARD_PROVINCE_CODE, ''),
        ADDR1: safeString(merged.useCardAddress ? merged.CARD_ADDR1 : merged.ADDR1, ''),
        TUMBOL_CODE: safeString(merged.useCardAddress ? merged.CARD_TUMBOL_CODE : merged.TUMBOL_CODE, ''),
        AMPHER_CODE: safeString(merged.useCardAddress ? merged.CARD_AMPHER_CODE : merged.AMPHER_CODE, ''),
        PROVINCE_CODE: safeString(merged.useCardAddress ? merged.CARD_PROVINCE_CODE : merged.PROVINCE_CODE, ''),
        ZIPCODE: safeString(merged.useCardAddress ? merged.CARD_ZIPCODE : merged.ZIPCODE, ''),
        TEL1: safeString(merged.TEL1, ''),
        EMAIL1: safeString(merged.EMAIL1, ''),
        DISEASE1: safeString(merged.DISEASE1, ''),
        DRUG_ALLERGY: safeString(merged.DRUG_ALLERGY, ''),
        FOOD_ALLERGIES: safeString(merged.FOOD_ALLERGIES, ''),
        SOCIAL_CARD: merged.SOCIAL_CARD === 'Y' ? 'Y' : 'N',
        UCS_CARD: merged.UCS_CARD === 'Y' ? 'Y' : 'N',
        CARD_ZIPCODE: safeString(merged.CARD_ZIPCODE, ''),
        useCardAddress: !!merged.useCardAddress
    };
};

// GET all patients
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
      SELECT 
        p.*,
        prov.PROVINCE_NAME,
        amp.AMPHER_NAME,
        tumb.TUMBOL_NAME
      FROM patient1 p
      LEFT JOIN province prov ON p.PROVINCE_CODE = prov.PROVINCE_CODE
      LEFT JOIN ampher amp ON p.AMPHER_CODE = amp.AMPHER_CODE
      LEFT JOIN tumbol tumb ON p.TUMBOL_CODE = tumb.TUMBOL_CODE
      ORDER BY p.HNCODE
      LIMIT 100
    `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย',
            error: error.message
        });
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
    try {
        const db = await require('../config/db');
        const { hn } = req.params;
        const [rows] = await db.execute(`
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
    }
});

// Search patients by name or HN
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
      SELECT 
        p.HNCODE, p.IDNO, p.PRENAME, p.NAME1, p.SURNAME, 
        p.SEX, p.AGE, p.BDATE, p.TEL1, p.EMAIL1,
        prov.PROVINCE_NAME,
        amp.AMPHER_NAME,
        tumb.TUMBOL_NAME
      FROM patient1 p
      LEFT JOIN province prov ON p.PROVINCE_CODE = prov.PROVINCE_CODE
      LEFT JOIN ampher amp ON p.AMPHER_CODE = amp.AMPHER_CODE
      LEFT JOIN tumbol tumb ON p.TUMBOL_CODE = tumb.TUMBOL_CODE
      WHERE p.HNCODE LIKE ? OR p.IDNO LIKE ? OR p.NAME1 LIKE ? OR p.SURNAME LIKE ?
      ORDER BY p.HNCODE
      LIMIT 50
    `, [searchTerm, searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching patients:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลผู้ป่วย',
            error: error.message
        });
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
            SOCIAL_CARD, UCS_CARD
        } = req.body;

        const preparedData = preparePatientInsertData({
            HNCODE,
            IDNO,
            PRENAME,
            NAME1,
            SURNAME,
            SEX,
            BDATE,
            AGE,
            BLOOD_GROUP1,
            OCCUPATION1,
            ORIGIN1,
            NATIONAL1,
            RELIGION1,
            STATUS1,
            WEIGHT1,
            HIGH1,
            CARD_ADDR1,
            CARD_TUMBOL_CODE,
            CARD_AMPHER_CODE,
            CARD_PROVINCE_CODE,
            ADDR1,
            TUMBOL_CODE,
            AMPHER_CODE,
            PROVINCE_CODE,
            ZIPCODE,
            TEL1,
            EMAIL1,
            DISEASE1,
            DRUG_ALLERGY,
            FOOD_ALLERGIES,
            SOCIAL_CARD,
            UCS_CARD,
            CARD_ZIPCODE: req.body.CARD_ZIPCODE,
            useCardAddress: req.body.useCardAddress
        });

        const normalizedIdNo = preparedData.IDNO ? preparedData.IDNO.trim() : null;
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

        let hnToUse = preparedData.HNCODE ? preparedData.HNCODE.trim() : '';

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
              CARD_PROVINCE_CODE, CARD_ZIPCODE, ADDR1, TUMBOL_CODE, AMPHER_CODE, PROVINCE_CODE,
              ZIPCODE, TEL1, EMAIL1, DISEASE1, DRUG_ALLERGY, FOOD_ALLERGIES,
              SOCIAL_CARD, UCS_CARD
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
                    hnToUse,
                    preparedData.IDNO,
                    preparedData.PRENAME,
                    preparedData.NAME1,
                    preparedData.SURNAME,
                    preparedData.SEX,
                    preparedData.BDATE,
                    preparedData.AGE,
                    preparedData.BLOOD_GROUP1,
                    preparedData.OCCUPATION1,
                    preparedData.ORIGIN1,
                    preparedData.NATIONAL1,
                    preparedData.RELIGION1,
                    preparedData.STATUS1,
                    preparedData.WEIGHT1,
                    preparedData.HIGH1,
                    preparedData.CARD_ADDR1,
                    preparedData.CARD_TUMBOL_CODE,
                    preparedData.CARD_AMPHER_CODE,
                    preparedData.CARD_PROVINCE_CODE,
                    preparedData.CARD_ZIPCODE,
                    preparedData.ADDR1,
                    preparedData.TUMBOL_CODE,
                    preparedData.AMPHER_CODE,
                    preparedData.PROVINCE_CODE,
                    preparedData.ZIPCODE,
                    preparedData.TEL1,
                    preparedData.EMAIL1,
                    preparedData.DISEASE1,
                    preparedData.DRUG_ALLERGY,
                    preparedData.FOOD_ALLERGIES,
                    preparedData.SOCIAL_CARD,
                    preparedData.UCS_CARD
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
    try {
        const db = await require('../config/db');
        const { hn } = req.params;
        const {
            IDNO, PRENAME, NAME1, SURNAME, SEX, BDATE, AGE,
            BLOOD_GROUP1, OCCUPATION1, ORIGIN1, NATIONAL1, RELIGION1, STATUS1,
            WEIGHT1, HIGH1, CARD_ADDR1, CARD_TUMBOL_CODE, CARD_AMPHER_CODE,
            CARD_PROVINCE_CODE, ADDR1, TUMBOL_CODE, AMPHER_CODE, PROVINCE_CODE,
            ZIPCODE, TEL1, EMAIL1, DISEASE1, DRUG_ALLERGY, FOOD_ALLERGIES,
            SOCIAL_CARD, UCS_CARD
        } = req.body;

        const [result] = await db.execute(`
      UPDATE patient1 SET 
        IDNO = ?, PRENAME = ?, NAME1 = ?, SURNAME = ?, SEX = ?, BDATE = ?, AGE = ?,
        BLOOD_GROUP1 = ?, OCCUPATION1 = ?, ORIGIN1 = ?, NATIONAL1 = ?, RELIGION1 = ?, STATUS1 = ?,
        WEIGHT1 = ?, HIGH1 = ?, CARD_ADDR1 = ?, CARD_TUMBOL_CODE = ?, CARD_AMPHER_CODE = ?,
        CARD_PROVINCE_CODE = ?, ADDR1 = ?, TUMBOL_CODE = ?, AMPHER_CODE = ?, PROVINCE_CODE = ?,
        ZIPCODE = ?, TEL1 = ?, EMAIL1 = ?, DISEASE1 = ?, DRUG_ALLERGY = ?, FOOD_ALLERGIES = ?,
        SOCIAL_CARD = ?, UCS_CARD = ?
      WHERE HNCODE = ?
    `, [
            IDNO, PRENAME, NAME1, SURNAME, SEX, BDATE, AGE,
            BLOOD_GROUP1, OCCUPATION1, ORIGIN1, NATIONAL1, RELIGION1, STATUS1,
            WEIGHT1, HIGH1, CARD_ADDR1, CARD_TUMBOL_CODE, CARD_AMPHER_CODE,
            CARD_PROVINCE_CODE, ADDR1, TUMBOL_CODE, AMPHER_CODE, PROVINCE_CODE,
            ZIPCODE, TEL1, EMAIL1, DISEASE1, DRUG_ALLERGY, FOOD_ALLERGIES,
            SOCIAL_CARD, UCS_CARD, hn
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้ป่วยที่ต้องการแก้ไข'
            });
        }

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
        console.error('Error updating patient:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ป่วย',
            error: error.message
        });
    }
});

// DELETE patient
router.delete('/:hn', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { hn } = req.params;

        const [result] = await db.execute('DELETE FROM patient1 WHERE HNCODE = ?', [hn]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้ป่วยที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลผู้ป่วยสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลผู้ป่วย',
            error: error.message
        });
    }
});

module.exports = router;