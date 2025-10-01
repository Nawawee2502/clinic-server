const express = require('express');
const router = express.Router();

// ✅ GET all drugs with enhanced filtering
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search, page = 1, limit = 10000, type, unit_code, drug_formulations } = req.query;

        // เพิ่ม limit สูงสุดเป็น 10000 เพื่อรองรับข้อมูลยาจำนวนมาก
        const limitInt = Math.max(1, Math.min(10000, parseInt(limit) || 10000));
        const pageInt = Math.max(1, parseInt(page) || 1);
        const offset = (pageInt - 1) * limitInt;

        let query = `SELECT * FROM TABLE_DRUG WHERE 1=1`;
        let params = [];

        if (search) {
            query += ` AND (GENERIC_NAME LIKE ? OR TRADE_NAME LIKE ? OR DRUG_CODE LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (type) {
            query += ` AND Type1 LIKE ?`;
            params.push(`%${type}%`);
        }

        if (unit_code) {
            query += ` AND UNIT_CODE = ?`;
            params.push(unit_code);
        }

        if (drug_formulations) {
            query += ` AND Drug_formulations = ?`;
            params.push(drug_formulations);
        }

        query += ` ORDER BY GENERIC_NAME LIMIT ${limitInt} OFFSET ${offset}`;

        console.log('🔍 Executing query:', query);
        const [rows] = await db.execute(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM TABLE_DRUG WHERE 1=1`;
        let countParams = [];

        if (search) {
            countQuery += ` AND (GENERIC_NAME LIKE ? OR TRADE_NAME LIKE ? OR DRUG_CODE LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }
        if (type) {
            countQuery += ` AND Type1 LIKE ?`;
            countParams.push(`%${type}%`);
        }
        if (unit_code) {
            countQuery += ` AND UNIT_CODE = ?`;
            countParams.push(unit_code);
        }
        if (drug_formulations) {
            countQuery += ` AND Drug_formulations = ?`;
            countParams.push(drug_formulations);
        }

        const [countResult] = await db.execute(countQuery, countParams);

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
        console.error('❌ Error fetching drugs:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยา',
            error: error.message
        });
    }
});

// ✅ GET drug by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(`SELECT * FROM TABLE_DRUG WHERE DRUG_CODE = ?`, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยา'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยา',
            error: error.message
        });
    }
});

// ✅ POST create new drug - รองรับ fields ทั้งหมด
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        console.log('📝 Received data:', req.body);

        const {
            DRUG_CODE, GENERIC_NAME, TRADE_NAME, UNIT_CODE, UNIT_PRICE,
            Type1, Dose1, Indication1, Effect1, Contraindications1,
            Comment1, Drug_formulations, SOCIAL_CARD, UCS_CARD
        } = req.body;

        if (!DRUG_CODE || !GENERIC_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสยาและชื่อสามัญ'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO TABLE_DRUG (
                DRUG_CODE, GENERIC_NAME, TRADE_NAME, UNIT_CODE, UNIT_PRICE,
                Type1, Dose1, Indication1, Effect1, Contraindications1,
                Comment1, Drug_formulations, SOCIAL_CARD, UCS_CARD
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            DRUG_CODE,
            GENERIC_NAME,
            TRADE_NAME || null,
            UNIT_CODE || null,
            UNIT_PRICE || null,
            Type1 || null,
            Dose1 || null,
            Indication1 || null,
            Effect1 || 'None',
            Contraindications1 || 'None',
            Comment1 || 'None',
            Drug_formulations || null,
            SOCIAL_CARD || 'N',
            UCS_CARD || 'N'
        ]);

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลยาสำเร็จ',
            data: {
                DRUG_CODE,
                GENERIC_NAME,
                TRADE_NAME
            }
        });
    } catch (error) {
        console.error('❌ Error creating drug:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสยานี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลยา',
                error: error.message
            });
        }
    }
});

// ✅ PUT update drug - รองรับ fields ทั้งหมด
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        console.log('📝 Updating drug:', code, 'with data:', req.body);

        const {
            GENERIC_NAME, TRADE_NAME, UNIT_CODE, UNIT_PRICE,
            Type1, Dose1, Indication1, Effect1, Contraindications1,
            Comment1, Drug_formulations, SOCIAL_CARD, UCS_CARD
        } = req.body;

        if (!GENERIC_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อสามัญยา'
            });
        }

        const [result] = await db.execute(`
            UPDATE TABLE_DRUG SET 
                GENERIC_NAME = ?, TRADE_NAME = ?, UNIT_CODE = ?, UNIT_PRICE = ?,
                Type1 = ?, Dose1 = ?, Indication1 = ?, Effect1 = ?, 
                Contraindications1 = ?, Comment1 = ?, Drug_formulations = ?,
                SOCIAL_CARD = ?, UCS_CARD = ?
            WHERE DRUG_CODE = ?
        `, [
            GENERIC_NAME,
            TRADE_NAME || null,
            UNIT_CODE || null,
            UNIT_PRICE || null,
            Type1 || null,
            Dose1 || null,
            Indication1 || null,
            Effect1 || 'None',
            Contraindications1 || 'None',
            Comment1 || 'None',
            Drug_formulations || null,
            SOCIAL_CARD || 'N',
            UCS_CARD || 'N',
            code
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยาที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลยาสำเร็จ',
            data: { DRUG_CODE: code, GENERIC_NAME, TRADE_NAME }
        });
    } catch (error) {
        console.error('❌ Error updating drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลยา',
            error: error.message
        });
    }
});

// ✅ DELETE drug
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        console.log('🗑️ Deleting drug:', code);

        const [result] = await db.execute('DELETE FROM TABLE_DRUG WHERE DRUG_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยาที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลยาสำเร็จ',
            deletedCode: code
        });
    } catch (error) {
        console.error('❌ Error deleting drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยา',
            error: error.message
        });
    }
});

// ✅ GET drug types (Type1)
router.get('/filters/types', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT DISTINCT Type1 FROM TABLE_DRUG 
            WHERE Type1 IS NOT NULL AND Type1 != ''
            ORDER BY Type1
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching types:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ✅ GET drug formulations
router.get('/filters/formulations', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT DISTINCT Drug_formulations FROM TABLE_DRUG 
            WHERE Drug_formulations IS NOT NULL AND Drug_formulations != ''
            ORDER BY Drug_formulations
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching formulations:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;