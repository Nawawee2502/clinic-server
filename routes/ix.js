const express = require('express');
const router = express.Router();

// GET all investigations
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search } = req.query;

        let query = 'SELECT * FROM table_ix WHERE 1=1';
        let params = [];

        if (search) {
            query += ' AND IXNAME LIKE ?';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY IXNAME';
        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching investigations:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตรวจ',
            error: error.message
        });
    }
});

// GET investigation by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM table_ix WHERE IXCODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching investigation:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตรวจ',
            error: error.message
        });
    }
});

// Search investigations
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT * FROM table_ix 
            WHERE IXNAME LIKE ? OR IXCODE LIKE ?
            ORDER BY IXNAME
            LIMIT 50
        `, [searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching investigations:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลการตรวจ',
            error: error.message
        });
    }
});

// POST create new investigation
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { IXCODE, IXNAME } = req.body;

        if (!IXCODE || !IXNAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อการตรวจ'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO table_ix (IXCODE, IXNAME) VALUES (?, ?)',
            [IXCODE, IXNAME]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลการตรวจสำเร็จ',
            data: { IXCODE, IXNAME }
        });
    } catch (error) {
        console.error('Error creating investigation:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสการตรวจนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลการตรวจ',
                error: error.message
            });
        }
    }
});

// PUT update investigation
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { IXNAME } = req.body;

        const [result] = await db.execute(
            'UPDATE table_ix SET IXNAME = ? WHERE IXCODE = ?',
            [IXNAME, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลการตรวจสำเร็จ',
            data: { IXCODE: code, IXNAME }
        });
    } catch (error) {
        console.error('Error updating investigation:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลการตรวจ',
            error: error.message
        });
    }
});

// DELETE investigation
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM table_ix WHERE IXCODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลการตรวจสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting investigation:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้การตรวจนี้ในการรักษา'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลการตรวจ',
                error: error.message
            });
        }
    }
});

module.exports = router;