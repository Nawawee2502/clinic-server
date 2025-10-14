const express = require('express');
const router = express.Router();

// GET all payment types
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT TYPE_PAY_CODE, TYPE_PAY_NAME 
            FROM TYPE_PAY 
            ORDER BY TYPE_PAY_CODE
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching payment types:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทรายจ่าย',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [total] = await db.execute('SELECT COUNT(*) as count FROM TYPE_PAY');

        res.json({
            success: true,
            data: {
                totalTypes: total[0].count,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching payment type stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติประเภทรายจ่าย',
            error: error.message
        });
    }
});

// GET payment type by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(
            'SELECT TYPE_PAY_CODE, TYPE_PAY_NAME FROM TYPE_PAY WHERE TYPE_PAY_CODE = ?',
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทรายจ่าย'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching payment type:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทรายจ่าย',
            error: error.message
        });
    }
});

// Search payment types by name or code
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT TYPE_PAY_CODE, TYPE_PAY_NAME 
            FROM TYPE_PAY 
            WHERE TYPE_PAY_CODE LIKE ? OR TYPE_PAY_NAME LIKE ?
            ORDER BY TYPE_PAY_CODE
        `, [searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching payment types:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลประเภทรายจ่าย',
            error: error.message
        });
    }
});

// Check if payment type code exists
router.get('/check/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(
            'SELECT TYPE_PAY_CODE, TYPE_PAY_NAME FROM TYPE_PAY WHERE TYPE_PAY_CODE = ?',
            [code]
        );

        res.json({
            success: true,
            exists: rows.length > 0,
            data: rows.length > 0 ? rows[0] : null
        });
    } catch (error) {
        console.error('Error checking payment type code:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสประเภทรายจ่าย',
            error: error.message
        });
    }
});

// POST create new payment type
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { TYPE_PAY_CODE, TYPE_PAY_NAME } = req.body;

        if (!TYPE_PAY_CODE || !TYPE_PAY_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อประเภทรายจ่าย'
            });
        }

        if (TYPE_PAY_CODE.length > 3) {
            return res.status(400).json({
                success: false,
                message: 'รหัสประเภทรายจ่ายต้องไม่เกิน 3 ตัวอักษร'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO TYPE_PAY (TYPE_PAY_CODE, TYPE_PAY_NAME) VALUES (?, ?)',
            [TYPE_PAY_CODE, TYPE_PAY_NAME]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลประเภทรายจ่ายสำเร็จ',
            data: {
                TYPE_PAY_CODE,
                TYPE_PAY_NAME
            }
        });
    } catch (error) {
        console.error('Error creating payment type:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสประเภทรายจ่ายนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลประเภทรายจ่าย',
                error: error.message
            });
        }
    }
});

// PUT update payment type
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { TYPE_PAY_NAME } = req.body;

        if (!TYPE_PAY_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อประเภทรายจ่าย'
            });
        }

        const [result] = await db.execute(
            'UPDATE TYPE_PAY SET TYPE_PAY_NAME = ? WHERE TYPE_PAY_CODE = ?',
            [TYPE_PAY_NAME, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทรายจ่ายที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลประเภทรายจ่ายสำเร็จ',
            data: {
                TYPE_PAY_CODE: code,
                TYPE_PAY_NAME
            }
        });
    } catch (error) {
        console.error('Error updating payment type:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลประเภทรายจ่าย',
            error: error.message
        });
    }
});

// DELETE payment type
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute(
            'DELETE FROM TYPE_PAY WHERE TYPE_PAY_CODE = ?',
            [code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทรายจ่ายที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลประเภทรายจ่ายสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting payment type:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลประเภทรายจ่าย',
            error: error.message
        });
    }
});

module.exports = router;