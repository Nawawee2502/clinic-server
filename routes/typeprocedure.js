const express = require('express');
const router = express.Router();

// GET all type procedures
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT * FROM TYPE_PROCEDURE 
            ORDER BY TYPE_PROCEDURE_CODE
        `);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('❌ Error fetching type procedures:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทหัตถการ',
            error: error.message
        });
    }
});

// GET type procedure by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(`
            SELECT * FROM TYPE_PROCEDURE 
            WHERE TYPE_PROCEDURE_CODE = ?
        `, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทหัตถการ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('❌ Error fetching type procedure:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทหัตถการ',
            error: error.message
        });
    }
});

// POST create new type procedure
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { TYPE_PROCEDURE_CODE, TYPE_PROCEDURE_NAME } = req.body;

        if (!TYPE_PROCEDURE_CODE || !TYPE_PROCEDURE_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสประเภทหัตถการและชื่อประเภทหัตถการ'
            });
        }

        // Check if code already exists
        const [existing] = await db.execute(`
            SELECT TYPE_PROCEDURE_CODE FROM TYPE_PROCEDURE 
            WHERE TYPE_PROCEDURE_CODE = ?
        `, [TYPE_PROCEDURE_CODE]);

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'รหัสประเภทหัตถการนี้มีอยู่แล้ว'
            });
        }

        await db.execute(`
            INSERT INTO TYPE_PROCEDURE (TYPE_PROCEDURE_CODE, TYPE_PROCEDURE_NAME)
            VALUES (?, ?)
        `, [TYPE_PROCEDURE_CODE, TYPE_PROCEDURE_NAME]);

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลประเภทหัตถการสำเร็จ',
            data: {
                TYPE_PROCEDURE_CODE,
                TYPE_PROCEDURE_NAME
            }
        });
    } catch (error) {
        console.error('❌ Error creating type procedure:', error);
        
        // Handle duplicate entry
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            return res.status(400).json({
                success: false,
                message: 'รหัสประเภทหัตถการนี้มีอยู่แล้ว'
            });
        }

        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลประเภทหัตถการ',
            error: error.message
        });
    }
});

// PUT update type procedure
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { TYPE_PROCEDURE_NAME } = req.body;

        if (!TYPE_PROCEDURE_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อประเภทหัตถการ'
            });
        }

        // Check if exists
        const [existing] = await db.execute(`
            SELECT TYPE_PROCEDURE_CODE FROM TYPE_PROCEDURE 
            WHERE TYPE_PROCEDURE_CODE = ?
        `, [code]);

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทหัตถการ'
            });
        }

        await db.execute(`
            UPDATE TYPE_PROCEDURE 
            SET TYPE_PROCEDURE_NAME = ?
            WHERE TYPE_PROCEDURE_CODE = ?
        `, [TYPE_PROCEDURE_NAME, code]);

        res.json({
            success: true,
            message: 'อัพเดตข้อมูลประเภทหัตถการสำเร็จ',
            data: {
                TYPE_PROCEDURE_CODE: code,
                TYPE_PROCEDURE_NAME
            }
        });
    } catch (error) {
        console.error('❌ Error updating type procedure:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัพเดตข้อมูลประเภทหัตถการ',
            error: error.message
        });
    }
});

// DELETE type procedure
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        // Check if exists
        const [existing] = await db.execute(`
            SELECT TYPE_PROCEDURE_CODE FROM TYPE_PROCEDURE 
            WHERE TYPE_PROCEDURE_CODE = ?
        `, [code]);

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทหัตถการ'
            });
        }

        // Check if type procedure is being used in TABLE_MEDICAL_PROCEDURES
        const [inUse] = await db.execute(`
            SELECT COUNT(*) as count FROM TABLE_MEDICAL_PROCEDURES 
            WHERE MED_PRO_TYPE = ?
        `, [code]);

        if (inUse[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `ไม่สามารถลบได้ เนื่องจากประเภทหัตถการนี้ถูกใช้งานในข้อมูลหัตถการ ${inUse[0].count} รายการ`
            });
        }

        await db.execute(`
            DELETE FROM TYPE_PROCEDURE 
            WHERE TYPE_PROCEDURE_CODE = ?
        `, [code]);

        res.json({
            success: true,
            message: 'ลบข้อมูลประเภทหัตถการสำเร็จ'
        });
    } catch (error) {
        console.error('❌ Error deleting type procedure:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลประเภทหัตถการ',
            error: error.message
        });
    }
});

module.exports = router;

