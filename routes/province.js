const express = require('express');
const router = express.Router();

// GET all provinces
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute('SELECT * FROM province ORDER BY PROVINCE_NAME');
        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching provinces:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลจังหวัด',
            error: error.message
        });
    }
});

// GET province by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM province WHERE PROVINCE_CODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลจังหวัด'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching province:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลจังหวัด',
            error: error.message
        });
    }
});

// POST create new province
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { PROVINCE_CODE, PROVINCE_NAME } = req.body;

        if (!PROVINCE_CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสจังหวัด'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO province (PROVINCE_CODE, PROVINCE_NAME) VALUES (?, ?)',
            [PROVINCE_CODE, PROVINCE_NAME]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลจังหวัดสำเร็จ',
            data: {
                PROVINCE_CODE,
                PROVINCE_NAME
            }
        });
    } catch (error) {
        console.error('Error creating province:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสจังหวัดนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลจังหวัด',
                error: error.message
            });
        }
    }
});

// PUT update province
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { PROVINCE_NAME } = req.body;

        const [result] = await db.execute(
            'UPDATE province SET PROVINCE_NAME = ? WHERE PROVINCE_CODE = ?',
            [PROVINCE_NAME, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลจังหวัดที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลจังหวัดสำเร็จ',
            data: {
                PROVINCE_CODE: code,
                PROVINCE_NAME
            }
        });
    } catch (error) {
        console.error('Error updating province:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลจังหวัด',
            error: error.message
        });
    }
});

// DELETE province
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM province WHERE PROVINCE_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลจังหวัดที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลจังหวัดสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting province:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีข้อมูลอื่นที่เชื่อมโยงอยู่'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลจังหวัด',
                error: error.message
            });
        }
    }
});

module.exports = router;