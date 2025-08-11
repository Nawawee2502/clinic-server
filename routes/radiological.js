const express = require('express');
const router = express.Router();

// GET all radiological tests
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search } = req.query;

        let query = 'SELECT * FROM table_radiological WHERE 1=1';
        let params = [];

        if (search) {
            query += ' AND RLNAME LIKE ?';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY RLNAME';
        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching radiological tests:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตรวจทางรังสี',
            error: error.message
        });
    }
});

// GET radiological by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM table_radiological WHERE RLCODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจทางรังสี'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching radiological test:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตรวจทางรังสี',
            error: error.message
        });
    }
});

// Search radiological tests
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT * FROM table_radiological 
            WHERE RLNAME LIKE ? OR RLCODE LIKE ?
            ORDER BY RLNAME
            LIMIT 50
        `, [searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching radiological tests:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลการตรวจทางรังสี',
            error: error.message
        });
    }
});

// POST create new radiological test
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { RLCODE, RLNAME } = req.body;

        if (!RLCODE || !RLNAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อการตรวจทางรังสี'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO table_radiological (RLCODE, RLNAME) VALUES (?, ?)',
            [RLCODE, RLNAME]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลการตรวจทางรังสีสำเร็จ',
            data: { RLCODE, RLNAME }
        });
    } catch (error) {
        console.error('Error creating radiological test:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสการตรวจนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลการตรวจทางรังสี',
                error: error.message
            });
        }
    }
});

// PUT update radiological test
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { RLNAME } = req.body;

        const [result] = await db.execute(
            'UPDATE table_radiological SET RLNAME = ? WHERE RLCODE = ?',
            [RLNAME, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลการตรวจทางรังสีสำเร็จ',
            data: { RLCODE: code, RLNAME }
        });
    } catch (error) {
        console.error('Error updating radiological test:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลการตรวจทางรังสี',
            error: error.message
        });
    }
});

// DELETE radiological test
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM table_radiological WHERE RLCODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลการตรวจที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลการตรวจทางรังสีสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting radiological test:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้การตรวจนี้ในการรักษา'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลการตรวจทางรังสี',
                error: error.message
            });
        }
    }
});

module.exports = router;