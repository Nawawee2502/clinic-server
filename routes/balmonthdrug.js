const express = require('express');
const router = express.Router();

// GET all balance records with optional filters
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month, drugCode } = req.query;

        let query = `
            SELECT 
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            FROM BAL_MONTH_DRUG
        `;

        const conditions = [];
        const params = [];

        if (year) {
            conditions.push('MYEAR = ?');
            params.push(year);
        }

        if (month) {
            conditions.push('MONTHH = ?');
            params.push(month);
        }

        if (drugCode) {
            conditions.push('DRUG_CODE = ?');
            params.push(drugCode);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY MYEAR DESC, MONTHH DESC, DRUG_CODE';

        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching balance records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดยกมา',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');
        
        const [total] = await db.execute('SELECT COUNT(*) as count FROM BAL_MONTH_DRUG');
        const [totalValue] = await db.execute('SELECT SUM(AMT) as total FROM BAL_MONTH_DRUG');
        const [totalQty] = await db.execute('SELECT SUM(QTY) as total FROM BAL_MONTH_DRUG');

        res.json({
            success: true,
            data: {
                totalRecords: total[0].count,
                totalValue: totalValue[0].total || 0,
                totalQuantity: totalQty[0].total || 0,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching balance stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติยอดยกมา',
            error: error.message
        });
    }
});

// GET balance by year and month
router.get('/period/:year/:month', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.params;

        const [rows] = await db.execute(
            `SELECT 
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            FROM BAL_MONTH_DRUG
            WHERE MYEAR = ? AND MONTHH = ?
            ORDER BY DRUG_CODE`,
            [year, month]
        );

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            period: { year, month }
        });
    } catch (error) {
        console.error('Error fetching balance by period:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดยกมาตามช่วงเวลา',
            error: error.message
        });
    }
});

// GET balance by drug code
router.get('/drug/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { drugCode } = req.params;

        const [rows] = await db.execute(
            `SELECT 
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            FROM BAL_MONTH_DRUG
            WHERE DRUG_CODE = ?
            ORDER BY MYEAR DESC, MONTHH DESC`,
            [drugCode]
        );

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            drugCode: drugCode
        });
    } catch (error) {
        console.error('Error fetching balance by drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดยกมาตามรหัสยา',
            error: error.message
        });
    }
});

// GET specific balance record
router.get('/:year/:month/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month, drugCode } = req.params;

        const [rows] = await db.execute(
            `SELECT 
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            FROM BAL_MONTH_DRUG
            WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?`,
            [year, month, drugCode]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมา'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching balance record:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดยกมา',
            error: error.message
        });
    }
});

// Search balance records
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT 
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            FROM BAL_MONTH_DRUG
            WHERE DRUG_CODE LIKE ?
               OR UNIT_CODE1 LIKE ?
            ORDER BY MYEAR DESC, MONTHH DESC, DRUG_CODE
        `, [searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching balance records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลยอดยกมา',
            error: error.message
        });
    }
});

// Check if record exists
router.get('/check/:year/:month/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month, drugCode } = req.params;

        const [rows] = await db.execute(
            `SELECT MYEAR, MONTHH, DRUG_CODE, QTY, AMT 
             FROM BAL_MONTH_DRUG 
             WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?`,
            [year, month, drugCode]
        );

        res.json({
            success: true,
            exists: rows.length > 0,
            data: rows.length > 0 ? rows[0] : null
        });
    } catch (error) {
        console.error('Error checking balance record:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูลยอดยกมา',
            error: error.message
        });
    }
});

// POST create new balance record
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const {
            MYEAR,
            MONTHH,
            DRUG_CODE,
            UNIT_CODE1,
            QTY,
            UNIT_PRICE,
            AMT
        } = req.body;

        // Validate required fields
        if (!MYEAR || !MONTHH || !DRUG_CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุปี เดือน และรหัสยา'
            });
        }

        // Check if record already exists
        const [existing] = await db.execute(
            'SELECT * FROM BAL_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?',
            [MYEAR, MONTHH, DRUG_CODE]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'มีข้อมูลยอดยกมาสำหรับปี เดือน และรหัสยานี้อยู่แล้ว'
            });
        }

        await db.execute(
            `INSERT INTO BAL_MONTH_DRUG (
                MYEAR, 
                MONTHH, 
                DRUG_CODE, 
                UNIT_CODE1, 
                QTY, 
                UNIT_PRICE, 
                AMT
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1 || null,
                QTY || 0,
                UNIT_PRICE || 0,
                AMT || 0
            ]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลยอดยกมาสำเร็จ',
            data: {
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            }
        });
    } catch (error) {
        console.error('Error creating balance record:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'มีข้อมูลยอดยกมานี้อยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลยอดยกมา',
                error: error.message
            });
        }
    }
});

// PUT update balance record
router.put('/:year/:month/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month, drugCode } = req.params;
        const {
            UNIT_CODE1,
            QTY,
            UNIT_PRICE,
            AMT
        } = req.body;

        const [result] = await db.execute(
            `UPDATE BAL_MONTH_DRUG SET 
                UNIT_CODE1 = ?, 
                QTY = ?, 
                UNIT_PRICE = ?, 
                AMT = ?
            WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?`,
            [
                UNIT_CODE1 || null,
                QTY || 0,
                UNIT_PRICE || 0,
                AMT || 0,
                year,
                month,
                drugCode
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลยอดยกมาสำเร็จ',
            data: {
                MYEAR: year,
                MONTHH: month,
                DRUG_CODE: drugCode,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            }
        });
    } catch (error) {
        console.error('Error updating balance record:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลยอดยกมา',
            error: error.message
        });
    }
});

// DELETE balance record
router.delete('/:year/:month/:drugCode', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month, drugCode } = req.params;

        const [result] = await db.execute(
            'DELETE FROM BAL_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?',
            [year, month, drugCode]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลยอดยกมาสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting balance record:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยอดยกมา',
            error: error.message
        });
    }
});

// DELETE all records for a specific period
router.delete('/period/:year/:month', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.params;

        const [result] = await db.execute(
            'DELETE FROM BAL_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ?',
            [year, month]
        );

        res.json({
            success: true,
            message: `ลบข้อมูลยอดยกมา ${result.affectedRows} รายการสำเร็จ`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        console.error('Error deleting balance records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยอดยกมา',
            error: error.message
        });
    }
});

module.exports = router;