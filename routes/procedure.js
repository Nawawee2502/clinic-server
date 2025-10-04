const express = require('express');
const router = express.Router();

// GET all medical procedures
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search, page = 1, limit = 50, type } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM TABLE_MEDICAL_PROCEDURES WHERE 1=1';
        let params = [];

        if (search) {
            query += ` AND (MEDICAL_PROCEDURE_CODE LIKE ? OR MED_PRO_NAME_THAI LIKE ? OR MED_PRO_NAME_ENG LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (type) {
            query += ` AND MED_PRO_TYPE LIKE ?`;
            params.push(`%${type}%`);
        }

        query += ' ORDER BY MED_PRO_NAME_THAI LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.execute(query, params);

        let countQuery = 'SELECT COUNT(*) as total FROM TABLE_MEDICAL_PROCEDURES WHERE 1=1';
        let countParams = [];

        if (search) {
            countQuery += ` AND (MEDICAL_PROCEDURE_CODE LIKE ? OR MED_PRO_NAME_THAI LIKE ? OR MED_PRO_NAME_ENG LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (type) {
            countQuery += ` AND MED_PRO_TYPE LIKE ?`;
            countParams.push(`%${type}%`);
        }

        const [countResult] = await db.execute(countQuery, countParams);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching medical procedures:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหัตถการ',
            error: error.message
        });
    }
});

router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute(`SELECT * FROM TABLE_MEDICAL_PROCEDURES WHERE MEDICAL_PROCEDURE_CODE = ?`, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลหัตถการ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching medical procedure:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหัตถการ',
            error: error.message
        });
    }
});

router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE
            FROM TABLE_MEDICAL_PROCEDURES 
            WHERE MED_PRO_NAME_THAI LIKE ? OR MED_PRO_NAME_ENG LIKE ? OR MEDICAL_PROCEDURE_CODE LIKE ?
            ORDER BY MED_PRO_NAME_THAI LIMIT 100
        `, [searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching medical procedures:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลหัตถการ',
            error: error.message
        });
    }
});

router.get('/type/:procedureType', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { procedureType } = req.params;
        const [rows] = await db.execute(`
            SELECT * FROM TABLE_MEDICAL_PROCEDURES WHERE MED_PRO_TYPE LIKE ? ORDER BY MED_PRO_NAME_THAI
        `, [`%${procedureType}%`]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            type: procedureType
        });
    } catch (error) {
        console.error('Error fetching procedures by type:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหัตถการตามประเภท',
            error: error.message
        });
    }
});

router.get('/types/list', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT MED_PRO_TYPE, COUNT(*) as count, AVG(UNIT_PRICE) as avg_price
            FROM TABLE_MEDICAL_PROCEDURES 
            WHERE MED_PRO_TYPE IS NOT NULL AND MED_PRO_TYPE != ''
            GROUP BY MED_PRO_TYPE ORDER BY MED_PRO_TYPE
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching procedure types:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงรายการประเภทหัตถการ',
            error: error.message
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE, SOCIAL_CARD, UCS_CARD } = req.body;

        if (!MEDICAL_PROCEDURE_CODE || !MED_PRO_NAME_THAI) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อหัตถการ'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO TABLE_MEDICAL_PROCEDURES 
            (MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE, SOCIAL_CARD, UCS_CARD) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE, SOCIAL_CARD || 'N', UCS_CARD || 'N']);

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลหัตถการสำเร็จ',
            data: { MEDICAL_PROCEDURE_CODE, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE }
        });
    } catch (error) {
        console.error('Error creating medical procedure:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสหัตถการนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลหัตถการ',
                error: error.message
            });
        }
    }
});

router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE, SOCIAL_CARD, UCS_CARD } = req.body;

        const [result] = await db.execute(`
            UPDATE TABLE_MEDICAL_PROCEDURES SET 
                MED_PRO_NAME_THAI = ?, MED_PRO_NAME_ENG = ?, 
                MED_PRO_TYPE = ?, UNIT_PRICE = ?, SOCIAL_CARD = ?, UCS_CARD = ?
            WHERE MEDICAL_PROCEDURE_CODE = ?
        `, [MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE, SOCIAL_CARD || 'N', UCS_CARD || 'N', code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลหัตถการที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลหัตถการสำเร็จ',
            data: { MEDICAL_PROCEDURE_CODE: code, MED_PRO_NAME_THAI, MED_PRO_NAME_ENG, MED_PRO_TYPE, UNIT_PRICE }
        });
    } catch (error) {
        console.error('Error updating medical procedure:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลหัตถการ',
            error: error.message
        });
    }
});

router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM TABLE_MEDICAL_PROCEDURES WHERE MEDICAL_PROCEDURE_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลหัตถการที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลหัตถการสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting medical procedure:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้หัตถการนี้ในการรักษา'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลหัตถการ',
                error: error.message
            });
        }
    }
});

router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [totalCount] = await db.execute('SELECT COUNT(*) as total FROM TABLE_MEDICAL_PROCEDURES');
        const [typeStats] = await db.execute(`
            SELECT MED_PRO_TYPE, COUNT(*) as count, AVG(UNIT_PRICE) as avg_price, MIN(UNIT_PRICE) as min_price, MAX(UNIT_PRICE) as max_price
            FROM TABLE_MEDICAL_PROCEDURES WHERE MED_PRO_TYPE IS NOT NULL AND MED_PRO_TYPE != ''
            GROUP BY MED_PRO_TYPE ORDER BY count DESC
        `);
        const [priceStats] = await db.execute(`
            SELECT AVG(UNIT_PRICE) as avg_price, MIN(UNIT_PRICE) as min_price, MAX(UNIT_PRICE) as max_price
            FROM TABLE_MEDICAL_PROCEDURES WHERE UNIT_PRICE IS NOT NULL AND UNIT_PRICE > 0
        `);

        res.json({
            success: true,
            data: {
                totalProcedures: totalCount[0].total,
                byType: typeStats,
                priceStatistics: priceStats[0],
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching procedure statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติข้อมูลหัตถการ',
            error: error.message
        });
    }
});

module.exports = router;