const express = require('express');
const router = express.Router();

// GET drug lots by DRUG_CODE (ต้องอยู่ก่อน /:drugCode เพื่อไม่ให้ conflict)
router.get('/:drugCode/lots', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { drugCode } = req.params;

        console.log('🔍 Fetching lots for drug:', drugCode);

        const query = `
            SELECT DISTINCT LOT_NO, EXPIRE_DATE 
            FROM bal_drug 
            WHERE DRUG_CODE = ? 
            AND QTY > 0
            AND LOT_NO IS NOT NULL
            AND LOT_NO != ''
            AND EXPIRE_DATE IS NOT NULL
            ORDER BY EXPIRE_DATE ASC
        `;

        const [rows] = await db.execute(query, [drugCode]);

        console.log('✅ Found lots:', rows.length);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('❌ Error fetching drug lots:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล LOT',
            error: error.message
        });
    }
});

// GET drug balance by DRUG_CODE
router.get('/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { drugCode } = req.params;

        const [rows] = await db.execute(`
            SELECT DRUG_CODE, QTY, UNIT_CODE1
            FROM bal_drug
            WHERE DRUG_CODE = ?
        `, [drugCode]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดคงเหลือ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching drug balance:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// GET all drug balances (with pagination)
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;

        const [rows] = await db.execute(`
            SELECT *
            FROM bal_drug
            ORDER BY DRUG_CODE
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM bal_drug');

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching drug balances:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// POST - Create new drug balance
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { DRUG_CODE, QTY, UNIT_CODE1, LOT_NO, EXPIRE_DATE } = req.body;

        // Validate required fields
        if (!DRUG_CODE || QTY === undefined) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสยาและจำนวน'
            });
        }

        // Check if already exists
        const [existing] = await db.execute(
            'SELECT * FROM bal_drug WHERE DRUG_CODE = ? AND LOT_NO = ?',
            [DRUG_CODE, LOT_NO || '']
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'รหัสยาและ LOT นี้มีอยู่แล้ว'
            });
        }

        const query = `
            INSERT INTO bal_drug (DRUG_CODE, QTY, UNIT_CODE1, LOT_NO, EXPIRE_DATE)
            VALUES (?, ?, ?, ?, ?)
        `;

        await db.execute(query, [
            DRUG_CODE,
            QTY || 0,
            UNIT_CODE1 || null,
            LOT_NO || null,
            EXPIRE_DATE || null
        ]);

        res.status(201).json({
            success: true,
            message: 'สร้างข้อมูลยอดคงเหลือสำเร็จ'
        });
    } catch (error) {
        console.error('Error creating drug balance:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างข้อมูล',
            error: error.message
        });
    }
});

// PUT - Update drug balance
router.put('/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { drugCode } = req.params;
        const { QTY, UNIT_CODE1, LOT_NO, EXPIRE_DATE } = req.body;

        // Check if exists
        const [existing] = await db.execute(
            'SELECT * FROM bal_drug WHERE DRUG_CODE = ?',
            [drugCode]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดคงเหลือ'
            });
        }

        const query = `
            UPDATE bal_drug 
            SET QTY = ?,
                UNIT_CODE1 = ?,
                LOT_NO = ?,
                EXPIRE_DATE = ?
            WHERE DRUG_CODE = ?
        `;

        await db.execute(query, [
            QTY !== undefined ? QTY : existing[0].QTY,
            UNIT_CODE1 !== undefined ? UNIT_CODE1 : existing[0].UNIT_CODE1,
            LOT_NO !== undefined ? LOT_NO : existing[0].LOT_NO,
            EXPIRE_DATE !== undefined ? EXPIRE_DATE : existing[0].EXPIRE_DATE,
            drugCode
        ]);

        res.json({
            success: true,
            message: 'อัพเดทข้อมูลยอดคงเหลือสำเร็จ'
        });
    } catch (error) {
        console.error('Error updating drug balance:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล',
            error: error.message
        });
    }
});

// DELETE - Delete drug balance
router.delete('/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { drugCode } = req.params;

        // Check if exists
        const [existing] = await db.execute(
            'SELECT * FROM bal_drug WHERE DRUG_CODE = ?',
            [drugCode]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดคงเหลือ'
            });
        }

        await db.execute('DELETE FROM bal_drug WHERE DRUG_CODE = ?', [drugCode]);

        res.json({
            success: true,
            message: 'ลบข้อมูลยอดคงเหลือสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting drug balance:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูล',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as totalItems,
                SUM(QTY) as totalQty,
                COUNT(DISTINCT DRUG_CODE) as uniqueDrugs
            FROM bal_drug
        `);

        const [lowStock] = await db.execute(`
            SELECT COUNT(*) as count
            FROM bal_drug
            WHERE QTY > 0 AND QTY <= 10
        `);

        const [outOfStock] = await db.execute(`
            SELECT COUNT(*) as count
            FROM bal_drug
            WHERE QTY <= 0
        `);

        res.json({
            success: true,
            data: {
                ...stats[0],
                lowStock: lowStock[0].count,
                outOfStock: outOfStock[0].count
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
            error: error.message
        });
    }
});

module.exports = router;