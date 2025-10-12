const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('./users');

// ============================================
// GET /api/bank - ดึงรายการธนาคารทั้งหมด
// ============================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');

        const [rows] = await db.execute(`
            SELECT 
                bank_code,
                bank_name
            FROM BANK
            ORDER BY bank_code
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('Error fetching banks:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลธนาคาร',
            error: error.message
        });
    }
});

// ============================================
// GET /api/bank/:code - ดึงข้อมูลธนาคารตาม code
// ============================================
router.get('/:code', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(`
            SELECT 
                bank_code,
                bank_name
            FROM BANK
            WHERE bank_code = ?
        `, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลธนาคาร'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('Error fetching bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลธนาคาร',
            error: error.message
        });
    }
});

// ============================================
// POST /api/bank - สร้างธนาคารใหม่ (Admin Only)
// ============================================
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { bankCode, bankName } = req.body;

        // Validation
        if (!bankCode || !bankName) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกรหัสธนาคารและชื่อธนาคาร'
            });
        }

        // ตรวจสอบว่ามี bank_code ซ้ำหรือไม่
        const [existing] = await db.execute(
            'SELECT bank_code FROM BANK WHERE bank_code = ?',
            [bankCode]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'รหัสธนาคารนี้มีอยู่แล้ว'
            });
        }

        await db.execute(`
            INSERT INTO BANK (bank_code, bank_name)
            VALUES (?, ?)
        `, [bankCode, bankName]);

        res.status(201).json({
            success: true,
            message: 'สร้างข้อมูลธนาคารสำเร็จ'
        });

    } catch (error) {
        console.error('Error creating bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างข้อมูลธนาคาร',
            error: error.message
        });
    }
});

// ============================================
// PUT /api/bank/:code - อัปเดตข้อมูลธนาคาร (Admin Only)
// ============================================
router.put('/:code', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { bankName } = req.body;

        // Validation
        if (!bankName) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกชื่อธนาคาร'
            });
        }

        // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
        const [existing] = await db.execute(
            'SELECT bank_code FROM BANK WHERE bank_code = ?',
            [code]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลธนาคาร'
            });
        }

        await db.execute(`
            UPDATE BANK 
            SET bank_name = ?
            WHERE bank_code = ?
        `, [bankName, code]);

        res.json({
            success: true,
            message: 'อัปเดตข้อมูลธนาคารสำเร็จ'
        });

    } catch (error) {
        console.error('Error updating bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลธนาคาร',
            error: error.message
        });
    }
});

// ============================================
// DELETE /api/bank/:code - ลบธนาคาร (Admin Only)
// ============================================
router.delete('/:code', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
        const [existing] = await db.execute(
            'SELECT bank_code FROM BANK WHERE bank_code = ?',
            [code]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลธนาคาร'
            });
        }

        await db.execute('DELETE FROM BANK WHERE bank_code = ?', [code]);

        res.json({
            success: true,
            message: 'ลบข้อมูลธนาคารสำเร็จ'
        });

    } catch (error) {
        console.error('Error deleting bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลธนาคาร',
            error: error.message
        });
    }
});

module.exports = router;