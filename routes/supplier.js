const express = require('express');
const router = express.Router();

// GET all suppliers
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT 
                SUPPLIER_CODE,
                SUPPLIER_NAME,
                ADDR1,
                ADDR2,
                CONTACT1,
                TEL1,
                DAY1
            FROM SUPPLIER 
            ORDER BY SUPPLIER_CODE
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้จัดจำหน่าย',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [total] = await db.execute('SELECT COUNT(*) as count FROM SUPPLIER');

        res.json({
            success: true,
            data: {
                totalSuppliers: total[0].count,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching supplier stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติผู้จัดจำหน่าย',
            error: error.message
        });
    }
});

// GET supplier by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(
            `SELECT 
                SUPPLIER_CODE,
                SUPPLIER_NAME,
                ADDR1,
                ADDR2,
                CONTACT1,
                TEL1,
                DAY1
            FROM SUPPLIER 
            WHERE SUPPLIER_CODE = ?`,
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้จัดจำหน่าย'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้จัดจำหน่าย',
            error: error.message
        });
    }
});

// Search suppliers
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT 
                SUPPLIER_CODE,
                SUPPLIER_NAME,
                ADDR1,
                ADDR2,
                CONTACT1,
                TEL1,
                DAY1
            FROM SUPPLIER 
            WHERE SUPPLIER_CODE LIKE ? 
               OR SUPPLIER_NAME LIKE ?
               OR CONTACT1 LIKE ?
               OR TEL1 LIKE ?
            ORDER BY SUPPLIER_CODE
        `, [searchTerm, searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching suppliers:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลผู้จัดจำหน่าย',
            error: error.message
        });
    }
});

// Check if supplier code exists
router.get('/check/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(
            'SELECT SUPPLIER_CODE, SUPPLIER_NAME FROM SUPPLIER WHERE SUPPLIER_CODE = ?',
            [code]
        );

        res.json({
            success: true,
            exists: rows.length > 0,
            data: rows.length > 0 ? rows[0] : null
        });
    } catch (error) {
        console.error('Error checking supplier code:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผู้จัดจำหน่าย',
            error: error.message
        });
    }
});

// POST create new supplier
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const {
            SUPPLIER_CODE,
            SUPPLIER_NAME,
            ADDR1,
            ADDR2,
            CONTACT1,
            TEL1,
            DAY1
        } = req.body;

        if (!SUPPLIER_CODE || !SUPPLIER_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อผู้จัดจำหน่าย'
            });
        }

        if (SUPPLIER_CODE.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'รหัสผู้จัดจำหน่ายต้องไม่เกิน 20 ตัวอักษร'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO SUPPLIER (
                SUPPLIER_CODE, 
                SUPPLIER_NAME, 
                ADDR1, 
                ADDR2, 
                CONTACT1, 
                TEL1, 
                DAY1
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                SUPPLIER_CODE,
                SUPPLIER_NAME,
                ADDR1 || null,
                ADDR2 || null,
                CONTACT1 || null,
                TEL1 || null,
                DAY1 || null
            ]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลผู้จัดจำหน่ายสำเร็จ',
            data: {
                SUPPLIER_CODE,
                SUPPLIER_NAME,
                ADDR1,
                ADDR2,
                CONTACT1,
                TEL1,
                DAY1
            }
        });
    } catch (error) {
        console.error('Error creating supplier:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสผู้จัดจำหน่ายนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลผู้จัดจำหน่าย',
                error: error.message
            });
        }
    }
});

// PUT update supplier
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const {
            SUPPLIER_NAME,
            ADDR1,
            ADDR2,
            CONTACT1,
            TEL1,
            DAY1
        } = req.body;

        if (!SUPPLIER_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อผู้จัดจำหน่าย'
            });
        }

        const [result] = await db.execute(
            `UPDATE SUPPLIER SET 
                SUPPLIER_NAME = ?, 
                ADDR1 = ?, 
                ADDR2 = ?, 
                CONTACT1 = ?, 
                TEL1 = ?, 
                DAY1 = ?
            WHERE SUPPLIER_CODE = ?`,
            [
                SUPPLIER_NAME,
                ADDR1 || null,
                ADDR2 || null,
                CONTACT1 || null,
                TEL1 || null,
                DAY1 || null,
                code
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้จัดจำหน่ายที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลผู้จัดจำหน่ายสำเร็จ',
            data: {
                SUPPLIER_CODE: code,
                SUPPLIER_NAME,
                ADDR1,
                ADDR2,
                CONTACT1,
                TEL1,
                DAY1
            }
        });
    } catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้จัดจำหน่าย',
            error: error.message
        });
    }
});

// DELETE supplier
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute(
            'DELETE FROM SUPPLIER WHERE SUPPLIER_CODE = ?',
            [code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้จัดจำหน่ายที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลผู้จัดจำหน่ายสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลผู้จัดจำหน่าย',
            error: error.message
        });
    }
});

module.exports = router;