const express = require('express');
const router = express.Router();

// GET all balance records with optional filters (พร้อม JOIN TABLE_UNIT และ TABLE_DRUG)
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month, drugCode } = req.query;

        let query = `
            SELECT 
                b.MYEAR,
                b.MONTHH,
                b.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                b.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                b.QTY,
                b.UNIT_PRICE,
                b.AMT
            FROM STOCK_CARD b
            LEFT JOIN TABLE_DRUG d ON b.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON b.UNIT_CODE1 = u.UNIT_CODE
        `;

        const conditions = [];
        const params = [];

        if (year) {
            conditions.push('b.MYEAR = ?');
            params.push(year);
        }

        if (month) {
            conditions.push('b.MONTHH = ?');
            params.push(month);
        }

        if (drugCode) {
            conditions.push('b.DRUG_CODE = ?');
            params.push(drugCode);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY b.MYEAR DESC, b.MONTHH DESC, b.DRUG_CODE';

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

        const [total] = await db.execute('SELECT COUNT(*) as count FROM STOCK_CARD');
        const [totalValue] = await db.execute('SELECT SUM(AMT) as total FROM STOCK_CARD');
        const [totalQty] = await db.execute('SELECT SUM(QTY) as total FROM STOCK_CARD');

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
                b.MYEAR,
                b.MONTHH,
                b.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                b.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                b.QTY,
                b.UNIT_PRICE,
                b.AMT
            FROM STOCK_CARD b
            LEFT JOIN TABLE_DRUG d ON b.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON b.UNIT_CODE1 = u.UNIT_CODE
            WHERE b.MYEAR = ? AND b.MONTHH = ?
            ORDER BY b.DRUG_CODE`,
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
                b.MYEAR,
                b.MONTHH,
                b.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                b.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                b.QTY,
                b.UNIT_PRICE,
                b.AMT
            FROM STOCK_CARD b
            LEFT JOIN TABLE_DRUG d ON b.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON b.UNIT_CODE1 = u.UNIT_CODE
            WHERE b.DRUG_CODE = ?
            ORDER BY b.MYEAR DESC, b.MONTHH DESC`,
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
                b.MYEAR,
                b.MONTHH,
                b.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                b.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                b.QTY,
                b.UNIT_PRICE,
                b.AMT
            FROM STOCK_CARD b
            LEFT JOIN TABLE_DRUG d ON b.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON b.UNIT_CODE1 = u.UNIT_CODE
            WHERE b.MYEAR = ? AND b.MONTHH = ? AND b.DRUG_CODE = ?`,
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
                b.MYEAR,
                b.MONTHH,
                b.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                b.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                b.QTY,
                b.UNIT_PRICE,
                b.AMT
            FROM STOCK_CARD b
            LEFT JOIN TABLE_DRUG d ON b.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON b.UNIT_CODE1 = u.UNIT_CODE
            WHERE b.DRUG_CODE LIKE ?
               OR d.GENERIC_NAME LIKE ?
               OR d.TRADE_NAME LIKE ?
               OR b.UNIT_CODE1 LIKE ?
            ORDER BY b.MYEAR DESC, b.MONTHH DESC, b.DRUG_CODE
        `, [searchTerm, searchTerm, searchTerm, searchTerm]);

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
            `SELECT 
                b.MYEAR, 
                b.MONTHH, 
                b.DRUG_CODE, 
                b.QTY, 
                b.AMT,
                d.TRADE_NAME
             FROM STOCK_CARD b
             LEFT JOIN TABLE_DRUG d ON b.DRUG_CODE = d.DRUG_CODE
             WHERE b.MYEAR = ? AND b.MONTHH = ? AND b.DRUG_CODE = ?`,
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
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            MYEAR,
            MONTHH,
            DRUG_CODE,
            UNIT_CODE1,
            QTY,
            UNIT_PRICE,
            AMT,
            LOT_NO,
            EXPIRE_DATE,
            TEXPIRE_DATE
        } = req.body;

        // Validate required fields
        if (!MYEAR || !MONTHH || !DRUG_CODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุปี เดือน และรหัสยา'
            });
        }

        // Check if drug exists
        const [drugCheck] = await connection.execute(
            'SELECT DRUG_CODE FROM TABLE_DRUG WHERE DRUG_CODE = ?',
            [DRUG_CODE]
        );

        if (drugCheck.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสยานี้ในระบบ'
            });
        }

        // Check if record already exists in STOCK_CARD
        const [existing] = await connection.execute(
            'SELECT * FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?',
            [MYEAR, MONTHH, DRUG_CODE]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'มีข้อมูลยอดยกมาสำหรับปี เดือน และรหัสยานี้อยู่แล้ว'
            });
        }

        // 1. เพิ่มข้อมูลเข้า STOCK_CARD (ยอดยกมา = BEG1)
        await connection.execute(
            `INSERT INTO STOCK_CARD (
                MYEAR, 
                MONTHH, 
                DRUG_CODE, 
                UNIT_CODE1, 
                BEG1,
                IN1,
                OUT1,
                UPD1,
                UNIT_COST,
                IN1_AMT,
                OUT1_AMT,
                UPD1_AMT,
                LOTNO,
                EXPIRE_DATE
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1 || null,
                QTY || 0,           // BEG1 = ยอดยกมา
                0,                   // IN1
                0,                   // OUT1
                0,                   // UPD1
                UNIT_PRICE || 0,    // UNIT_COST
                0,                   // IN1_AMT
                0,                   // OUT1_AMT
                0,                   // UPD1_AMT
                LOT_NO || null,
                EXPIRE_DATE || null
            ]
        );

        // 2. เพิ่มข้อมูลเข้า BAL_DRUG
        await connection.execute(
            `INSERT INTO BAL_DRUG (
                DRUG_CODE,
                LOT_NO,
                EXPIRE_DATE,
                TEXPIRE_DATE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                DRUG_CODE,
                LOT_NO || null,
                EXPIRE_DATE || null,
                TEXPIRE_DATE || null,
                UNIT_CODE1 || null,
                QTY || 0,
                UNIT_PRICE || 0,
                AMT || 0
            ]
        );

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลยอดยกมาสำเร็จ และอัปเดต BAL_DRUG แล้ว',
            data: {
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT,
                LOT_NO,
                EXPIRE_DATE,
                TEXPIRE_DATE
            }
        });
    } catch (error) {
        await connection.rollback();
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
    } finally {
        connection.release();
    }
});

// PUT update balance record
router.put('/:year/:month/:drugCode', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month, drugCode } = req.params;
        const {
            UNIT_CODE1,
            QTY,
            UNIT_PRICE,
            AMT,
            LOT_NO,
            EXPIRE_DATE,
            TEXPIRE_DATE
        } = req.body;

        // 1. อัปเดต STOCK_CARD
        const [result] = await connection.execute(
            `UPDATE STOCK_CARD SET 
                UNIT_CODE1 = ?, 
                BEG1 = ?, 
                UNIT_COST = ?,
                LOTNO = ?,
                EXPIRE_DATE = ?
            WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?`,
            [
                UNIT_CODE1 || null,
                QTY || 0,
                UNIT_PRICE || 0,
                LOT_NO || null,
                EXPIRE_DATE || null,
                year,
                month,
                drugCode
            ]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาที่ต้องการแก้ไข'
            });
        }

        // 2. อัปเดต BAL_DRUG (ลบเดิมแล้วเพิ่มใหม่ เพื่อให้แน่ใจว่าข้อมูลตรงกัน)
        await connection.execute(
            'DELETE FROM BAL_DRUG WHERE DRUG_CODE = ?',
            [drugCode]
        );

        await connection.execute(
            `INSERT INTO BAL_DRUG (
                DRUG_CODE,
                LOT_NO,
                EXPIRE_DATE,
                TEXPIRE_DATE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                drugCode,
                LOT_NO || null,
                EXPIRE_DATE || null,
                TEXPIRE_DATE || null,
                UNIT_CODE1 || null,
                QTY || 0,
                UNIT_PRICE || 0,
                AMT || 0
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลยอดยกมาสำเร็จ และอัปเดต BAL_DRUG แล้ว',
            data: {
                MYEAR: year,
                MONTHH: month,
                DRUG_CODE: drugCode,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT,
                LOT_NO,
                EXPIRE_DATE,
                TEXPIRE_DATE
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating balance record:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลยอดยกมา',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE balance record
router.delete('/:year/:month/:drugCode', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month, drugCode } = req.params;

        // 1. ลบข้อมูลจาก STOCK_CARD
        const [result] = await connection.execute(
            'DELETE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?',
            [year, month, drugCode]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาที่ต้องการลบ'
            });
        }

        // 2. ลบข้อมูลจาก BAL_DRUG
        await connection.execute(
            'DELETE FROM BAL_DRUG WHERE DRUG_CODE = ?',
            [drugCode]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบข้อมูลยอดยกมาสำเร็จ และลบข้อมูลใน BAL_DRUG แล้ว'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting balance record:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยอดยกมา',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE all records for a specific period
router.delete('/period/:year/:month', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month } = req.params;

        // ดึงรายการ DRUG_CODE ก่อนลบ
        const [drugs] = await connection.execute(
            'SELECT DRUG_CODE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ?',
            [year, month]
        );

        // ลบข้อมูลจาก STOCK_CARD
        const [result] = await connection.execute(
            'DELETE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ?',
            [year, month]
        );

        // ลบข้อมูลจาก BAL_DRUG สำหรับยาที่ลบไป
        for (const drug of drugs) {
            await connection.execute(
                'DELETE FROM BAL_DRUG WHERE DRUG_CODE = ?',
                [drug.DRUG_CODE]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            message: `ลบข้อมูลยอดยกมา ${result.affectedRows} รายการสำเร็จ และลบข้อมูลใน BAL_DRUG แล้ว`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting balance records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยอดยกมา',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

module.exports = router;