const express = require('express');
const router = express.Router();

// GET all type drugs
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT * FROM TYPE_DRUG 
            ORDER BY TYPE_DRUG_CODE
        `);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('❌ Error fetching type drugs:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทยา',
            error: error.message
        });
    }
});

// GET type drug by code
router.get('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [rows] = await db.execute(`
            SELECT * FROM TYPE_DRUG 
            WHERE TYPE_DRUG_CODE = ?
        `, [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทยา'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('❌ Error fetching type drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทยา',
            error: error.message
        });
    }
});

// POST create new type drug
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { TYPE_DRUG_CODE, TYPE_DRUG_NAME } = req.body;

        if (!TYPE_DRUG_CODE || !TYPE_DRUG_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสประเภทยาและชื่อประเภทยา'
            });
        }

        // Check if code already exists
        const [existing] = await db.execute(`
            SELECT TYPE_DRUG_CODE FROM TYPE_DRUG 
            WHERE TYPE_DRUG_CODE = ?
        `, [TYPE_DRUG_CODE]);

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'รหัสประเภทยานี้มีอยู่แล้ว'
            });
        }

        await db.execute(`
            INSERT INTO TYPE_DRUG (TYPE_DRUG_CODE, TYPE_DRUG_NAME)
            VALUES (?, ?)
        `, [TYPE_DRUG_CODE, TYPE_DRUG_NAME]);

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลประเภทยาสำเร็จ',
            data: {
                TYPE_DRUG_CODE,
                TYPE_DRUG_NAME
            }
        });
    } catch (error) {
        console.error('❌ Error creating type drug:', error);
        
        // Handle duplicate entry
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            return res.status(400).json({
                success: false,
                message: 'รหัสประเภทยานี้มีอยู่แล้ว'
            });
        }

        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลประเภทยา',
            error: error.message
        });
    }
});

// PUT update type drug
router.put('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { TYPE_DRUG_NAME } = req.body;

        if (!TYPE_DRUG_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อประเภทยา'
            });
        }

        // Check if exists
        const [existing] = await db.execute(`
            SELECT TYPE_DRUG_CODE FROM TYPE_DRUG 
            WHERE TYPE_DRUG_CODE = ?
        `, [code]);

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทยา'
            });
        }

        await db.execute(`
            UPDATE TYPE_DRUG 
            SET TYPE_DRUG_NAME = ?
            WHERE TYPE_DRUG_CODE = ?
        `, [TYPE_DRUG_NAME, code]);

        res.json({
            success: true,
            message: 'อัพเดตข้อมูลประเภทยาสำเร็จ',
            data: {
                TYPE_DRUG_CODE: code,
                TYPE_DRUG_NAME
            }
        });
    } catch (error) {
        console.error('❌ Error updating type drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัพเดตข้อมูลประเภทยา',
            error: error.message
        });
    }
});

// DELETE type drug
router.delete('/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        // Check if exists
        const [existing] = await db.execute(`
            SELECT TYPE_DRUG_CODE FROM TYPE_DRUG 
            WHERE TYPE_DRUG_CODE = ?
        `, [code]);

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลประเภทยา'
            });
        }

        // Check if type drug is being used in TABLE_DRUG
        const [inUse] = await db.execute(`
            SELECT COUNT(*) as count FROM TABLE_DRUG 
            WHERE Type1 = ?
        `, [code]);

        if (inUse[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `ไม่สามารถลบได้ เนื่องจากประเภทยานี้ถูกใช้งานในข้อมูลยา ${inUse[0].count} รายการ`
            });
        }

        await db.execute(`
            DELETE FROM TYPE_DRUG 
            WHERE TYPE_DRUG_CODE = ?
        `, [code]);

        res.json({
            success: true,
            message: 'ลบข้อมูลประเภทยาสำเร็จ'
        });
    } catch (error) {
        console.error('❌ Error deleting type drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลประเภทยา',
            error: error.message
        });
    }
});

module.exports = router;

