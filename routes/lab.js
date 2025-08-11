const express = require('express');
const router = express.Router();

// GET all lab tests
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search } = req.query;

        let query = 'SELECT * FROM table_lab WHERE 1=1';
        let params = [];

        if (search) {
            query += ' AND LABNAME LIKE ?';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY LABNAME';
        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching lab tests:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตรวจทางห้องปฏิบัติการ',
            error: error.message
        });
    }
});

// GET lab by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM table_lab WHERE LABCODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจทางห้องปฏิบัติการ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching lab test:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตรวจทางห้องปฏิบัติการ',
            error: error.message
        });
    }
});

// Search lab tests
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT * FROM table_lab 
            WHERE LABNAME LIKE ? OR LABCODE LIKE ?
            ORDER BY LABNAME
            LIMIT 50
        `, [searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching lab tests:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลการตรวจทางห้องปฏิบัติการ',
            error: error.message
        });
    }
});

// POST create new lab test
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { LABCODE, LABNAME } = req.body;

        if (!LABCODE || !LABNAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อการตรวจทางห้องปฏิบัติการ'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO table_lab (LABCODE, LABNAME) VALUES (?, ?)',
            [LABCODE, LABNAME]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลการตรวจทางห้องปฏิบัติการสำเร็จ',
            data: { LABCODE, LABNAME }
        });
    } catch (error) {
        console.error('Error creating lab test:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสการตรวจนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลการตรวจทางห้องปฏิบัติการ',
                error: error.message
            });
        }
    }
});

// PUT update lab test
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { LABNAME } = req.body;

        const [result] = await db.execute(
            'UPDATE table_lab SET LABNAME = ? WHERE LABCODE = ?',
            [LABNAME, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลการตรวจทางห้องปฏิบัติการสำเร็จ',
            data: { LABCODE: code, LABNAME }
        });
    } catch (error) {
        console.error('Error updating lab test:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลการตรวจทางห้องปฏิบัติการ',
            error: error.message
        });
    }
});

// DELETE lab test
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM table_lab WHERE LABCODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลการตรวจทางห้องปฏิบัติการสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting lab test:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้การตรวจนี้ในการรักษา'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลการตรวจทางห้องปฏิบัติการ',
                error: error.message
            });
        }
    }
});

module.exports = router;