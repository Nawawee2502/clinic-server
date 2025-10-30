const express = require('express');
const router = express.Router();

// GET all balance records with optional filters
router.get('/', async (req, res) => {
    try {
        const pool = require('../config/db');
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
            FROM BEG_MONTH_DRUG b
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

        console.log('📝 Executing query:', query);
        console.log('📝 With params:', params);

        const [rows] = await pool.execute(query, params);

        console.log(`✅ Found ${rows.length} records`);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('❌ Error fetching balance records:', error);
        console.error('❌ Stack:', error.stack);
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
        const pool = require('../config/db');

        const [total] = await pool.execute('SELECT COUNT(*) as count FROM BEG_MONTH_DRUG');
        const [totalValue] = await pool.execute('SELECT SUM(AMT) as total FROM BEG_MONTH_DRUG');
        const [totalQty] = await pool.execute('SELECT SUM(QTY) as total FROM BEG_MONTH_DRUG');

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
        const pool = require('../config/db');
        const { year, month } = req.params;

        const [rows] = await pool.execute(
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
            FROM BEG_MONTH_DRUG b
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
        const pool = require('../config/db');
        const { drugCode } = req.params;

        const [rows] = await pool.execute(
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
            FROM BEG_MONTH_DRUG b
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
        const pool = require('../config/db');
        const { year, month, drugCode } = req.params;

        const [rows] = await pool.execute(
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
            FROM BEG_MONTH_DRUG b
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
        const pool = require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await pool.execute(`
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
            FROM BEG_MONTH_DRUG b
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
        const pool = require('../config/db');
        const { year, month, drugCode } = req.params;

        const [rows] = await pool.execute(
            `SELECT 
                b.MYEAR, 
                b.MONTHH, 
                b.DRUG_CODE, 
                b.QTY, 
                b.AMT,
                d.TRADE_NAME
             FROM BEG_MONTH_DRUG b
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

// POST create new balance record (เพิ่มทั้ง 3 ตาราง)
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
            AMT
        } = req.body;

        console.log('📝 Received data:', req.body);

        // Validate required fields
        if (!MYEAR || !MONTHH || !DRUG_CODE) {
            await connection.rollback();
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
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'ไม่พบรหัสยานี้ในระบบ'
            });
        }

        // Check if record already exists in BEG_MONTH_DRUG
        const [existing] = await connection.execute(
            'SELECT * FROM BEG_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?',
            [MYEAR, MONTHH, DRUG_CODE]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: 'มีข้อมูลยอดยกมาสำหรับปี เดือน และรหัสยานี้อยู่แล้ว'
            });
        }

        // 1. เพิ่มข้อมูลเข้า BEG_MONTH_DRUG (ตารางหลัก)
        await connection.execute(
            `INSERT INTO BEG_MONTH_DRUG (
                MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1, 
                QTY, UNIT_PRICE, AMT
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

        // 2. เพิ่มข้อมูลเข้า STOCK_CARD
        await connection.execute(
            `INSERT INTO STOCK_CARD (
                MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1, 
                BEG1, IN1, OUT1, UPD1,
                UNIT_COST, IN1_AMT, OUT1_AMT, UPD1_AMT,
                LOTNO, EXPIRE_DATE
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1 || null,
                QTY || 0, 0, 0, 0,
                UNIT_PRICE || 0, 0, 0, 0,
                '-', '-'
            ]
        );

        // 3. เพิ่มข้อมูลเข้า BAL_DRUG
        await connection.execute(
            `INSERT INTO BAL_DRUG (
                DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE,
                UNIT_CODE1, QTY, UNIT_PRICE, AMT
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                DRUG_CODE, '-', '-', '-',
                UNIT_CODE1 || null, QTY || 0, UNIT_PRICE || 0, AMT || 0
            ]
        );

        await connection.commit();

        console.log('✅ Balance record created successfully in 3 tables');

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลยอดยกมาสำเร็จในทั้ง 3 ตาราง',
            data: { MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1, QTY, UNIT_PRICE, AMT }
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error creating balance:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลยอดยกมา',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// PUT update balance record (อัปเดตทั้ง 3 ตาราง)
router.put('/:year/:month/:drugCode', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month, drugCode } = req.params;
        const { UNIT_CODE1, QTY, UNIT_PRICE, AMT } = req.body;

        console.log('📝 Updating:', { year, month, drugCode, UNIT_CODE1, QTY, UNIT_PRICE, AMT });

        // 1. อัปเดต BEG_MONTH_DRUG (ตารางหลัก)
        const [result] = await connection.execute(
            `UPDATE BEG_MONTH_DRUG SET 
                UNIT_CODE1 = ?, 
                QTY = ?, 
                UNIT_PRICE = ?,
                AMT = ?
            WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?`,
            [UNIT_CODE1 || null, QTY || 0, UNIT_PRICE || 0, AMT || 0, year, month, drugCode]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาที่ต้องการแก้ไข'
            });
        }

        // 2. อัปเดต STOCK_CARD
        await connection.execute(
            `UPDATE STOCK_CARD SET 
                UNIT_CODE1 = ?, BEG1 = ?, UNIT_COST = ?
            WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?`,
            [UNIT_CODE1 || null, QTY || 0, UNIT_PRICE || 0, year, month, drugCode]
        );

        // 3. อัปเดต BAL_DRUG (ลบแล้วเพิ่มใหม่)
        await connection.execute('DELETE FROM BAL_DRUG WHERE DRUG_CODE = ?', [drugCode]);
        await connection.execute(
            `INSERT INTO BAL_DRUG (DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE, UNIT_CODE1, QTY, UNIT_PRICE, AMT) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [drugCode, '-', '-', '-', UNIT_CODE1 || null, QTY || 0, UNIT_PRICE || 0, AMT || 0]
        );

        await connection.commit();

        console.log('✅ Balance record updated successfully in 3 tables');

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลยอดยกมาสำเร็จในทั้ง 3 ตาราง',
            data: { MYEAR: year, MONTHH: month, DRUG_CODE: drugCode, UNIT_CODE1, QTY, UNIT_PRICE, AMT }
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error updating balance:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลยอดยกมา',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE balance record (ลบทั้ง 3 ตาราง)
router.delete('/:year/:month/:drugCode', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month, drugCode } = req.params;

        console.log('🗑️ Deleting:', { year, month, drugCode });

        // 1. ลบจาก BEG_MONTH_DRUG (ตารางหลัก)
        const [result] = await connection.execute(
            'DELETE FROM BEG_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?',
            [year, month, drugCode]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาที่ต้องการลบ'
            });
        }

        // 2. ลบจาก STOCK_CARD
        await connection.execute(
            'DELETE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?',
            [year, month, drugCode]
        );

        // 3. ลบจาก BAL_DRUG
        await connection.execute('DELETE FROM BAL_DRUG WHERE DRUG_CODE = ?', [drugCode]);

        await connection.commit();

        console.log('✅ Balance record deleted successfully from 3 tables');

        res.json({
            success: true,
            message: 'ลบข้อมูลยอดยกมาสำเร็จจากทั้ง 3 ตาราง'
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error deleting balance:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยอดยกมา',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE all records for a specific period (ลบทั้ง 3 ตาราง)
router.delete('/period/:year/:month', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month } = req.params;

        console.log('🗑️ Deleting period:', { year, month });

        // ดึงรายการ DRUG_CODE ก่อนลบ
        const [drugs] = await connection.execute(
            'SELECT DRUG_CODE FROM BEG_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ?',
            [year, month]
        );

        // 1. ลบจาก BEG_MONTH_DRUG
        const [result] = await connection.execute(
            'DELETE FROM BEG_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ?',
            [year, month]
        );

        // 2. ลบจาก STOCK_CARD
        await connection.execute(
            'DELETE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ?',
            [year, month]
        );

        // 3. ลบจาก BAL_DRUG สำหรับยาที่ลบไป
        for (const drug of drugs) {
            await connection.execute('DELETE FROM BAL_DRUG WHERE DRUG_CODE = ?', [drug.DRUG_CODE]);
        }

        await connection.commit();

        console.log(`✅ Deleted ${result.affectedRows} records from 3 tables`);

        res.json({
            success: true,
            message: `ลบข้อมูลยอดยกมา ${result.affectedRows} รายการสำเร็จจากทั้ง 3 ตาราง`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error deleting balance records:', error);
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