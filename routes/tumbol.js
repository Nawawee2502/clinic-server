const express = require('express');
const router = express.Router();

// GET all tumbols
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
      SELECT 
        t.*,
        p.PROVINCE_NAME,
        a.AMPHER_NAME
      FROM tumbol t 
      LEFT JOIN province p ON t.PROVINCE_CODE = p.PROVINCE_CODE 
      LEFT JOIN ampher a ON t.AMPHER_CODE = a.AMPHER_CODE 
      ORDER BY t.TUMBOL_NAME
    `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching tumbols:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำบล',
            error: error.message
        });
    }
});

// GET tumbol by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute(`
      SELECT 
        t.*,
        p.PROVINCE_NAME,
        a.AMPHER_NAME
      FROM tumbol t 
      LEFT JOIN province p ON t.PROVINCE_CODE = p.PROVINCE_CODE 
      LEFT JOIN ampher a ON t.AMPHER_CODE = a.AMPHER_CODE 
      WHERE t.TUMBOL_CODE = ?
    `, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลตำบล'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching tumbol:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำบล',
            error: error.message
        });
    }
});

// GET tumbols by ampher code
router.get('/ampher/:ampherCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { ampherCode } = req.params;
        const [rows] = await db.execute(`
      SELECT 
        t.*,
        p.PROVINCE_NAME,
        a.AMPHER_NAME
      FROM tumbol t 
      LEFT JOIN province p ON t.PROVINCE_CODE = p.PROVINCE_CODE 
      LEFT JOIN ampher a ON t.AMPHER_CODE = a.AMPHER_CODE 
      WHERE t.AMPHER_CODE = ? 
      ORDER BY t.TUMBOL_NAME
    `, [ampherCode]);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching tumbols by ampher:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำบลตามอำเภอ',
            error: error.message
        });
    }
});

// GET tumbols by province code
router.get('/province/:provinceCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { provinceCode } = req.params;
        const [rows] = await db.execute(`
      SELECT 
        t.*,
        p.PROVINCE_NAME,
        a.AMPHER_NAME
      FROM tumbol t 
      LEFT JOIN province p ON t.PROVINCE_CODE = p.PROVINCE_CODE 
      LEFT JOIN ampher a ON t.AMPHER_CODE = a.AMPHER_CODE 
      WHERE t.PROVINCE_CODE = ? 
      ORDER BY a.AMPHER_NAME, t.TUMBOL_NAME
    `, [provinceCode]);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching tumbols by province:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำบลตามจังหวัด',
            error: error.message
        });
    }
});

// POST create new tumbol
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { TUMBOL_CODE, PROVINCE_CODE, TUMBOL_NAME, AMPHER_CODE, zipcode } = req.body;

        if (!TUMBOL_CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสตำบล'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO tumbol (TUMBOL_CODE, PROVINCE_CODE, TUMBOL_NAME, AMPHER_CODE, zipcode) VALUES (?, ?, ?, ?, ?)',
            [TUMBOL_CODE, PROVINCE_CODE, TUMBOL_NAME, AMPHER_CODE, zipcode]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลตำบลสำเร็จ',
            data: {
                TUMBOL_CODE,
                PROVINCE_CODE,
                TUMBOL_NAME,
                AMPHER_CODE,
                zipcode
            }
        });
    } catch (error) {
        console.error('Error creating tumbol:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสตำบลนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลตำบล',
                error: error.message
            });
        }
    }
});

// PUT update tumbol
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { PROVINCE_CODE, TUMBOL_NAME, AMPHER_CODE, zipcode } = req.body;

        const [result] = await db.execute(
            'UPDATE tumbol SET PROVINCE_CODE = ?, TUMBOL_NAME = ?, AMPHER_CODE = ?, zipcode = ? WHERE TUMBOL_CODE = ?',
            [PROVINCE_CODE, TUMBOL_NAME, AMPHER_CODE, zipcode, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลตำบลที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลตำบลสำเร็จ',
            data: {
                TUMBOL_CODE: code,
                PROVINCE_CODE,
                TUMBOL_NAME,
                AMPHER_CODE,
                zipcode
            }
        });
    } catch (error) {
        console.error('Error updating tumbol:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลตำบล',
            error: error.message
        });
    }
});

// DELETE tumbol
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM tumbol WHERE TUMBOL_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลตำบลที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลตำบลสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting tumbol:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีข้อมูลอื่นที่เชื่อมโยงอยู่'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลตำบล',
                error: error.message
            });
        }
    }
});

module.exports = router;