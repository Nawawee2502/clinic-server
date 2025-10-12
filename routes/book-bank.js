const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('./users');

// ============================================
// GET /api/book-bank - ดึงรายการบัญชีธนาคารทั้งหมด
// ============================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');

        const [rows] = await db.execute(`
            SELECT 
                bb.bank_code,
                bb.bank_no,
                bb.bank_branch,
                bb.bank_type,
                b.bank_name
            FROM BOOK_BANK bb
            LEFT JOIN BANK b ON bb.bank_code = b.bank_code
            ORDER BY bb.bank_code, bb.bank_no
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('Error fetching book banks:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีธนาคาร',
            error: error.message
        });
    }
});

// ============================================
// GET /api/book-bank/:bankCode/:bankNo - ดึงข้อมูลบัญชีธนาคารเฉพาะ
// ============================================
router.get('/:bankCode/:bankNo', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { bankCode, bankNo } = req.params;

        const [rows] = await db.execute(`
            SELECT 
                bb.bank_code,
                bb.bank_no,
                bb.bank_branch,
                bb.bank_type,
                b.bank_name
            FROM BOOK_BANK bb
            LEFT JOIN BANK b ON bb.bank_code = b.bank_code
            WHERE bb.bank_code = ? AND bb.bank_no = ?
        `, [bankCode, bankNo]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลบัญชีธนาคาร'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('Error fetching book bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีธนาคาร',
            error: error.message
        });
    }
});

// ============================================
// POST /api/book-bank - สร้างบัญชีธนาคารใหม่ (Admin Only)
// ============================================
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { bankCode, bankNo, bankBranch, bankType } = req.body;

        // Validation
        if (!bankCode || !bankNo) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกรหัสธนาคารและเลขที่บัญชี'
            });
        }

        // ตรวจสอบว่ามีบัญชีนี้อยู่แล้วหรือไม่
        const [existing] = await db.execute(
            'SELECT bank_code FROM BOOK_BANK WHERE bank_code = ? AND bank_no = ?',
            [bankCode, bankNo]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'บัญชีธนาคารนี้มีอยู่แล้ว'
            });
        }

        // ตรวจสอบว่า bank_code มีอยู่ในตาราง BANK หรือไม่
        const [bankExists] = await db.execute(
            'SELECT bank_code FROM BANK WHERE bank_code = ?',
            [bankCode]
        );

        if (bankExists.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสธนาคารนี้ในระบบ'
            });
        }

        await db.execute(`
            INSERT INTO BOOK_BANK (bank_code, bank_no, bank_branch, bank_type)
            VALUES (?, ?, ?, ?)
        `, [bankCode, bankNo, bankBranch, bankType]);

        res.status(201).json({
            success: true,
            message: 'สร้างข้อมูลบัญชีธนาคารสำเร็จ'
        });

    } catch (error) {
        console.error('Error creating book bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างข้อมูลบัญชีธนาคาร',
            error: error.message
        });
    }
});

// ============================================
// PUT /api/book-bank/:bankCode/:bankNo - อัปเดตข้อมูลบัญชีธนาคาร (Admin Only)
// ============================================
router.put('/:bankCode/:bankNo', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { bankCode, bankNo } = req.params;
        const { bankBranch, bankType } = req.body;

        // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
        const [existing] = await db.execute(
            'SELECT bank_code FROM BOOK_BANK WHERE bank_code = ? AND bank_no = ?',
            [bankCode, bankNo]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลบัญชีธนาคาร'
            });
        }

        const updates = [];
        const params = [];

        if (bankBranch !== undefined) {
            updates.push('bank_branch = ?');
            params.push(bankBranch);
        }
        if (bankType !== undefined) {
            updates.push('bank_type = ?');
            params.push(bankType);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'ไม่มีข้อมูลที่ต้องการอัปเดต'
            });
        }

        params.push(bankCode, bankNo);

        await db.execute(`
            UPDATE BOOK_BANK 
            SET ${updates.join(', ')}
            WHERE bank_code = ? AND bank_no = ?
        `, params);

        res.json({
            success: true,
            message: 'อัปเดตข้อมูลบัญชีธนาคารสำเร็จ'
        });

    } catch (error) {
        console.error('Error updating book bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลบัญชีธนาคาร',
            error: error.message
        });
    }
});

// ============================================
// DELETE /api/book-bank/:bankCode/:bankNo - ลบบัญชีธนาคาร (Admin Only)
// ============================================
router.delete('/:bankCode/:bankNo', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { bankCode, bankNo } = req.params;

        // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
        const [existing] = await db.execute(
            'SELECT bank_code FROM BOOK_BANK WHERE bank_code = ? AND bank_no = ?',
            [bankCode, bankNo]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลบัญชีธนาคาร'
            });
        }

        await db.execute(
            'DELETE FROM BOOK_BANK WHERE bank_code = ? AND bank_no = ?',
            [bankCode, bankNo]
        );

        res.json({
            success: true,
            message: 'ลบข้อมูลบัญชีธนาคารสำเร็จ'
        });

    } catch (error) {
        console.error('Error deleting book bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลบัญชีธนาคาร',
            error: error.message
        });
    }
});

module.exports = router;