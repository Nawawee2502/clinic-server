const express = require('express');
const router = express.Router();

// GET all diagnosis codes
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM table_dx WHERE 1=1';
        let params = [];

        if (search) {
            query += ' AND (DXCODE LIKE ? OR DXNAME_ENG LIKE ? OR DXNAME_THAI LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY DXCODE LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.execute(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM table_dx WHERE 1=1';
        let countParams = [];

        if (search) {
            countQuery += ' AND (DXCODE LIKE ? OR DXNAME_ENG LIKE ? OR DXNAME_THAI LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
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
        console.error('Error fetching diagnosis codes:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรหัสการวินิจฉัย',
            error: error.message
        });
    }
});

// GET diagnosis by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM table_dx WHERE DXCODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลรหัสการวินิจฉัย'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching diagnosis:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรหัสการวินิจฉัย',
            error: error.message
        });
    }
});

// Search diagnosis by name
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT * FROM table_dx 
            WHERE DXNAME_ENG LIKE ? OR DXNAME_THAI LIKE ? OR DXCODE LIKE ?
            ORDER BY DXNAME_THAI, DXNAME_ENG
            LIMIT 100
        `, [searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching diagnosis:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลรหัสการวินิจฉัย',
            error: error.message
        });
    }
});

// POST create new diagnosis
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { DXCODE, DXNAME_ENG, DXNAME_THAI } = req.body;

        if (!DXCODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสการวินิจฉัย'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO table_dx (DXCODE, DXNAME_ENG, DXNAME_THAI) VALUES (?, ?, ?)',
            [DXCODE, DXNAME_ENG, DXNAME_THAI]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลรหัสการวินิจฉัยสำเร็จ',
            data: { DXCODE, DXNAME_ENG, DXNAME_THAI }
        });
    } catch (error) {
        console.error('Error creating diagnosis:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสการวินิจฉัยนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลรหัสการวินิจฉัย',
                error: error.message
            });
        }
    }
});

// PUT update diagnosis
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { DXNAME_ENG, DXNAME_THAI } = req.body;

        const [result] = await db.execute(
            'UPDATE table_dx SET DXNAME_ENG = ?, DXNAME_THAI = ? WHERE DXCODE = ?',
            [DXNAME_ENG, DXNAME_THAI, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลรหัสการวินิจฉัยที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลรหัสการวินิจฉัยสำเร็จ',
            data: { DXCODE: code, DXNAME_ENG, DXNAME_THAI }
        });
    } catch (error) {
        console.error('Error updating diagnosis:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลรหัสการวินิจฉัย',
            error: error.message
        });
    }
});

// DELETE diagnosis
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM table_dx WHERE DXCODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลรหัสการวินิจฉัยที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลรหัสการวินิจฉัยสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting diagnosis:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้รหัสนี้ในการรักษา'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลรหัสการวินิจฉัย',
                error: error.message
            });
        }
    }
});

module.exports = router;