const express = require('express');
const router = express.Router();

// GET drug balance by DRUG_CODE
router.get('/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { drugCode } = req.params;

        const [rows] = await db.execute(`
            SELECT DRUG_CODE, QTY, UNIT_CODE1
            FROM BAL_DRUG
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
            FROM BAL_DRUG
            ORDER BY DRUG_CODE
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM BAL_DRUG');

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

module.exports = router;