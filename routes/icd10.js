const express = require('express');
const router = express.Router();

// GET all ICD-10 codes
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search, page = 1, limit = 50, medical_term } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM table_icd10 WHERE 1=1';
        let params = [];

        if (search) {
            query += ` AND (ICD10CODE LIKE ? OR ICD10NAME_THAI LIKE ? OR ICD10NAME_ENG LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (medical_term) {
            query += ` AND MEDICAL_TERM LIKE ?`;
            params.push(`%${medical_term}%`);
        }

        query += ' ORDER BY ICD10CODE LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.execute(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM table_icd10 WHERE 1=1';
        let countParams = [];

        if (search) {
            countQuery += ` AND (ICD10CODE LIKE ? OR ICD10NAME_THAI LIKE ? OR ICD10NAME_ENG LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (medical_term) {
            countQuery += ` AND MEDICAL_TERM LIKE ?`;
            countParams.push(`%${medical_term}%`);
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
        console.error('Error fetching ICD-10 codes:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรหัส ICD-10',
            error: error.message
        });
    }
});

// GET ICD-10 by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM table_icd10 WHERE ICD10CODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลรหัส ICD-10'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching ICD-10:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรหัส ICD-10',
            error: error.message
        });
    }
});

// Search ICD-10 by name
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT ICD10CODE, ICD10NAME_THAI, ICD10NAME_ENG, MEDICAL_TERM 
            FROM table_icd10 
            WHERE ICD10NAME_THAI LIKE ? OR ICD10NAME_ENG LIKE ? OR ICD10CODE LIKE ?
            ORDER BY ICD10NAME_THAI, ICD10CODE
            LIMIT 100
        `, [searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching ICD-10:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลรหัส ICD-10',
            error: error.message
        });
    }
});

// GET ICD-10 by medical term category
router.get('/category/:medical_term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { medical_term } = req.params;
        const [rows] = await db.execute(`
            SELECT * FROM table_icd10 
            WHERE MEDICAL_TERM LIKE ?
            ORDER BY ICD10CODE
        `, [`%${medical_term}%`]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            category: medical_term
        });
    } catch (error) {
        console.error('Error fetching ICD-10 by category:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรหัส ICD-10 ตามหมวดหมู่',
            error: error.message
        });
    }
});

// GET ICD-10 categories
router.get('/categories/list', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT 
                MEDICAL_TERM,
                COUNT(*) as count
            FROM table_icd10 
            WHERE MEDICAL_TERM IS NOT NULL AND MEDICAL_TERM != ''
            GROUP BY MEDICAL_TERM
            ORDER BY MEDICAL_TERM
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching ICD-10 categories:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงรายการหมวดหมู่ ICD-10',
            error: error.message
        });
    }
});

// POST create new ICD-10
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { ICD10CODE, ICD10NAME_THAI, ICD10NAME_ENG, MEDICAL_TERM, NOTE1 } = req.body;

        if (!ICD10CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัส ICD-10'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO table_icd10 (ICD10CODE, ICD10NAME_THAI, ICD10NAME_ENG, MEDICAL_TERM, NOTE1) 
            VALUES (?, ?, ?, ?, ?)
        `, [ICD10CODE, ICD10NAME_THAI, ICD10NAME_ENG, MEDICAL_TERM, NOTE1]);

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลรหัส ICD-10 สำเร็จ',
            data: { ICD10CODE, ICD10NAME_THAI, ICD10NAME_ENG, MEDICAL_TERM }
        });
    } catch (error) {
        console.error('Error creating ICD-10:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัส ICD-10 นี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลรหัส ICD-10',
                error: error.message
            });
        }
    }
});

// PUT update ICD-10
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { ICD10NAME_THAI, ICD10NAME_ENG, MEDICAL_TERM, NOTE1 } = req.body;

        const [result] = await db.execute(`
            UPDATE table_icd10 SET 
                ICD10NAME_THAI = ?, ICD10NAME_ENG = ?, MEDICAL_TERM = ?, NOTE1 = ?
            WHERE ICD10CODE = ?
        `, [ICD10NAME_THAI, ICD10NAME_ENG, MEDICAL_TERM, NOTE1, code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลรหัส ICD-10 ที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลรหัส ICD-10 สำเร็จ',
            data: { ICD10CODE: code, ICD10NAME_THAI, ICD10NAME_ENG, MEDICAL_TERM }
        });
    } catch (error) {
        console.error('Error updating ICD-10:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลรหัส ICD-10',
            error: error.message
        });
    }
});

// DELETE ICD-10
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM table_icd10 WHERE ICD10CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลรหัส ICD-10 ที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลรหัส ICD-10 สำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting ICD-10:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้รหัสนี้ในการรักษา'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลรหัส ICD-10',
                error: error.message
            });
        }
    }
});

// GET ICD-10 statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        // Total ICD-10 codes
        const [totalCount] = await db.execute('SELECT COUNT(*) as total FROM table_icd10');

        // Count by medical term
        const [categoryStats] = await db.execute(`
            SELECT 
                MEDICAL_TERM,
                COUNT(*) as count
            FROM table_icd10 
            WHERE MEDICAL_TERM IS NOT NULL AND MEDICAL_TERM != ''
            GROUP BY MEDICAL_TERM
            ORDER BY count DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            data: {
                totalCodes: totalCount[0].total,
                topCategories: categoryStats,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching ICD-10 statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติข้อมูลรหัส ICD-10',
            error: error.message
        });
    }
});

module.exports = router;