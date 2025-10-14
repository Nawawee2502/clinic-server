const express = require('express');
const router = express.Router();

// GET all income types
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT TYPE_INCOME_CODE, TYPE_INCOME_NAME 
            FROM TYPE_INCOME 
            ORDER BY TYPE_INCOME_CODE
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching income types:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทรายรับ',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [total] = await db.execute('SELECT COUNT(*) as count FROM TYPE_INCOME');

        res.json({
            success: true,
            data: {
                totalTypes: total[0].count,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching income type stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติประเภทรายรับ',
            error: error.message
        });
    }
});

// GET income type by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(
            'SELECT TYPE_INCOME_CODE, TYPE_INCOME_NAME FROM TYPE_INCOME WHERE TYPE_INCOME_CODE = ?',
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทรายรับ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching income type:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทรายรับ',
            error: error.message
        });
    }
});

// Search income types by name or code
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT TYPE_INCOME_CODE, TYPE_INCOME_NAME 
            FROM TYPE_INCOME 
            WHERE TYPE_INCOME_CODE LIKE ? OR TYPE_INCOME_NAME LIKE ?
            ORDER BY TYPE_INCOME_CODE
        `, [searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching income types:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลประเภทรายรับ',
            error: error.message
        });
    }
});

// Check if income type code exists
router.get('/check/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(
            'SELECT TYPE_INCOME_CODE, TYPE_INCOME_NAME FROM TYPE_INCOME WHERE TYPE_INCOME_CODE = ?',
            [code]
        );

        res.json({
            success: true,
            exists: rows.length > 0,
            data: rows.length > 0 ? rows[0] : null
        });
    } catch (error) {
        console.error('Error checking income type code:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสประเภทรายรับ',
            error: error.message
        });
    }
});

// POST create new income type
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { TYPE_INCOME_CODE, TYPE_INCOME_NAME } = req.body;

        if (!TYPE_INCOME_CODE || !TYPE_INCOME_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อประเภทรายรับ'
            });
        }

        if (TYPE_INCOME_CODE.length > 3) {
            return res.status(400).json({
                success: false,
                message: 'รหัสประเภทรายรับต้องไม่เกิน 3 ตัวอักษร'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO TYPE_INCOME (TYPE_INCOME_CODE, TYPE_INCOME_NAME) VALUES (?, ?)',
            [TYPE_INCOME_CODE, TYPE_INCOME_NAME]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลประเภทรายรับสำเร็จ',
            data: {
                TYPE_INCOME_CODE,
                TYPE_INCOME_NAME
            }
        });
    } catch (error) {
        console.error('Error creating income type:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสประเภทรายรับนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลประเภทรายรับ',
                error: error.message
            });
        }
    }
});

// PUT update income type
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { TYPE_INCOME_NAME } = req.body;

        if (!TYPE_INCOME_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อประเภทรายรับ'
            });
        }

        const [result] = await db.execute(
            'UPDATE TYPE_INCOME SET TYPE_INCOME_NAME = ? WHERE TYPE_INCOME_CODE = ?',
            [TYPE_INCOME_NAME, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทรายรับที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลประเภทรายรับสำเร็จ',
            data: {
                TYPE_INCOME_CODE: code,
                TYPE_INCOME_NAME
            }
        });
    } catch (error) {
        console.error('Error updating income type:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลประเภทรายรับ',
            error: error.message
        });
    }
});

// DELETE income type
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute(
            'DELETE FROM TYPE_INCOME WHERE TYPE_INCOME_CODE = ?',
            [code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทรายรับที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลประเภทรายรับสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting income type:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลประเภทรายรับ',
            error: error.message
        });
    }
});

module.exports = router;