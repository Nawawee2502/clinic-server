const express = require('express');
const router = express.Router();

// GET all amphers
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
      SELECT a.*, p.PROVINCE_NAME 
      FROM ampher a 
      LEFT JOIN province p ON a.PROVINCE_CODE = p.PROVINCE_CODE 
      ORDER BY a.AMPHER_NAME
    `);
        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching amphers:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอำเภอ',
            error: error.message
        });
    }
});

// GET ampher by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute(`
      SELECT a.*, p.PROVINCE_NAME 
      FROM ampher a 
      LEFT JOIN province p ON a.PROVINCE_CODE = p.PROVINCE_CODE 
      WHERE a.AMPHER_CODE = ?
    `, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลอำเภอ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching ampher:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอำเภอ',
            error: error.message
        });
    }
});

// GET amphers by province code
router.get('/province/:provinceCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { provinceCode } = req.params;
        const [rows] = await db.execute(`
      SELECT a.*, p.PROVINCE_NAME 
      FROM ampher a 
      LEFT JOIN province p ON a.PROVINCE_CODE = p.PROVINCE_CODE 
      WHERE a.PROVINCE_CODE = ? 
      ORDER BY a.AMPHER_NAME
    `, [provinceCode]);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching amphers by province:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอำเภอ',
            error: error.message
        });
    }
});

// POST create new ampher
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { AMPHER_CODE, AMPHER_NAME, PROVINCE_CODE } = req.body;

        if (!AMPHER_CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสอำเภอ'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO ampher (AMPHER_CODE, AMPHER_NAME, PROVINCE_CODE) VALUES (?, ?, ?)',
            [AMPHER_CODE, AMPHER_NAME, PROVINCE_CODE]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลอำเภอสำเร็จ',
            data: {
                AMPHER_CODE,
                AMPHER_NAME,
                PROVINCE_CODE
            }
        });
    } catch (error) {
        console.error('Error creating ampher:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสอำเภอนี้มีอยู่แล้ว'
            });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสจังหวัดที่ระบุ'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลอำเภอ',
                error: error.message
            });
        }
    }
});

// PUT update ampher
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { AMPHER_NAME, PROVINCE_CODE } = req.body;

        const [result] = await db.execute(
            'UPDATE ampher SET AMPHER_NAME = ?, PROVINCE_CODE = ? WHERE AMPHER_CODE = ?',
            [AMPHER_NAME, PROVINCE_CODE, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลอำเภอที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลอำเภอสำเร็จ',
            data: {
                AMPHER_CODE: code,
                AMPHER_NAME,
                PROVINCE_CODE
            }
        });
    } catch (error) {
        console.error('Error updating ampher:', error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสจังหวัดที่ระบุ'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลอำเภอ',
                error: error.message
            });
        }
    }
});

// DELETE ampher
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM ampher WHERE AMPHER_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลอำเภอที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลอำเภอสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting ampher:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีข้อมูลอื่นที่เชื่อมโยงอยู่'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลอำเภอ',
                error: error.message
            });
        }
    }
});

module.exports = router;

// GET all amphers
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(`
      SELECT a.*, p.PROVINCE_NAME 
      FROM ampher a 
      LEFT JOIN province p ON a.PROVINCE_CODE = p.PROVINCE_CODE 
      ORDER BY a.AMPHER_NAME
    `);
        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching amphers:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอำเภอ',
            error: error.message
        });
    }
});

// GET ampher by code
router.get('/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const [rows] = await db.execute(`
      SELECT a.*, p.PROVINCE_NAME 
      FROM ampher a 
      LEFT JOIN province p ON a.PROVINCE_CODE = p.PROVINCE_CODE 
      WHERE a.AMPHER_CODE = ?
    `, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลอำเภอ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching ampher:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอำเภอ',
            error: error.message
        });
    }
});

// GET amphers by province code
router.get('/province/:provinceCode', async (req, res) => {
    try {
        const { provinceCode } = req.params;
        const [rows] = await db.execute(`
      SELECT a.*, p.PROVINCE_NAME 
      FROM ampher a 
      LEFT JOIN province p ON a.PROVINCE_CODE = p.PROVINCE_CODE 
      WHERE a.PROVINCE_CODE = ? 
      ORDER BY a.AMPHER_NAME
    `, [provinceCode]);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching amphers by province:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอำเภอ',
            error: error.message
        });
    }
});

// POST create new ampher
router.post('/', async (req, res) => {
    try {
        const { AMPHER_CODE, AMPHER_NAME, PROVINCE_CODE } = req.body;

        if (!AMPHER_CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสอำเภอ'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO ampher (AMPHER_CODE, AMPHER_NAME, PROVINCE_CODE) VALUES (?, ?, ?)',
            [AMPHER_CODE, AMPHER_NAME, PROVINCE_CODE]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลอำเภอสำเร็จ',
            data: {
                AMPHER_CODE,
                AMPHER_NAME,
                PROVINCE_CODE
            }
        });
    } catch (error) {
        console.error('Error creating ampher:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสอำเภอนี้มีอยู่แล้ว'
            });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสจังหวัดที่ระบุ'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลอำเภอ',
                error: error.message
            });
        }
    }
});

// PUT update ampher
router.put('/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { AMPHER_NAME, PROVINCE_CODE } = req.body;

        const [result] = await db.execute(
            'UPDATE ampher SET AMPHER_NAME = ?, PROVINCE_CODE = ? WHERE AMPHER_CODE = ?',
            [AMPHER_NAME, PROVINCE_CODE, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลอำเภอที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลอำเภอสำเร็จ',
            data: {
                AMPHER_CODE: code,
                AMPHER_NAME,
                PROVINCE_CODE
            }
        });
    } catch (error) {
        console.error('Error updating ampher:', error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสจังหวัดที่ระบุ'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลอำเภอ',
                error: error.message
            });
        }
    }
});

// DELETE ampher
router.delete('/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM ampher WHERE AMPHER_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลอำเภอที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลอำเภอสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting ampher:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีข้อมูลอื่นที่เชื่อมโยงอยู่'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลอำเภอ',
                error: error.message
            });
        }
    }
});

module.exports = router;