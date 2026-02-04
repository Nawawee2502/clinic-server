const express = require('express');
const router = express.Router();

// GET all STOCK_CARD records with optional filters
router.get('/', async (req, res) => {
    try {
        const pool = require('../config/db');
        const { year, month, drugCode, refno, lotNo } = req.query;

        let query = `
            SELECT 
                s.REFNO,
                s.RDATE,
                s.TRDATE,
                s.MYEAR,
                s.MONTHH,
                s.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                s.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                s.BEG1,
                s.IN1,
                s.OUT1,
                s.UPD1,
                s.UNIT_COST,
                s.BEG1_AMT,
                s.IN1_AMT,
                s.OUT1_AMT,
                s.UPD1_AMT,
                s.LOTNO,
                s.EXPIRE_DATE
            FROM STOCK_CARD s
            LEFT JOIN TABLE_DRUG d ON s.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON s.UNIT_CODE1 = u.UNIT_CODE
        `;

        const conditions = [];
        const params = [];

        if (year) {
            const parsedYear = parseInt(year, 10);
            if (!Number.isNaN(parsedYear)) {
                conditions.push('s.MYEAR = ?');
                params.push(parsedYear);
            }
        }

        if (month) {
            const parsedMonth = parseInt(month, 10);
            if (!Number.isNaN(parsedMonth)) {
                conditions.push('s.MONTHH = ?');
                params.push(parsedMonth);
            }
        }

        if (drugCode) {
            conditions.push('s.DRUG_CODE = ?');
            params.push(drugCode);
        }

        if (refno) {
            conditions.push('s.REFNO = ?');
            params.push(refno);
        }

        if (lotNo) {
            if (lotNo === '-' || lotNo.toLowerCase() === 'null') {
                conditions.push('(s.LOTNO IS NULL OR s.LOTNO = \'-\' OR s.LOTNO = \'\')');
            } else {
                conditions.push('s.LOTNO = ?');
                params.push(lotNo);
            }
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY s.DRUG_CODE, s.RDATE, s.REFNO';

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
        console.error('❌ Error fetching stock card records:', error);
        console.error('❌ Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล STOCK_CARD',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const pool = require('../config/db');

        const [total] = await pool.execute('SELECT COUNT(*) as count FROM STOCK_CARD');
        const [totalBEG1] = await pool.execute('SELECT SUM(BEG1) as total FROM STOCK_CARD');
        const [totalIN1] = await pool.execute('SELECT SUM(IN1) as total FROM STOCK_CARD');
        const [totalOUT1] = await pool.execute('SELECT SUM(OUT1) as total FROM STOCK_CARD');
        const [totalUPD1] = await pool.execute('SELECT SUM(UPD1) as total FROM STOCK_CARD');
        const [totalBEG1_AMT] = await pool.execute('SELECT SUM(BEG1_AMT) as total FROM STOCK_CARD');
        const [totalIN1_AMT] = await pool.execute('SELECT SUM(IN1_AMT) as total FROM STOCK_CARD');
        const [totalOUT1_AMT] = await pool.execute('SELECT SUM(OUT1_AMT) as total FROM STOCK_CARD');
        const [totalUPD1_AMT] = await pool.execute('SELECT SUM(UPD1_AMT) as total FROM STOCK_CARD');

        res.json({
            success: true,
            data: {
                totalRecords: total[0].count,
                totalBEG1: totalBEG1[0].total || 0,
                totalIN1: totalIN1[0].total || 0,
                totalOUT1: totalOUT1[0].total || 0,
                totalUPD1: totalUPD1[0].total || 0,
                totalBEG1_AMT: totalBEG1_AMT[0].total || 0,
                totalIN1_AMT: totalIN1_AMT[0].total || 0,
                totalOUT1_AMT: totalOUT1_AMT[0].total || 0,
                totalUPD1_AMT: totalUPD1_AMT[0].total || 0,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching stock card stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติ STOCK_CARD',
            error: error.message
        });
    }
});

// GET stock cards by year and month
router.get('/period/:year/:month', async (req, res) => {
    try {
        const pool = require('../config/db');
        const { year, month } = req.params;

        const [rows] = await pool.execute(
            `SELECT 
                s.REFNO,
                s.RDATE,
                s.TRDATE,
                s.MYEAR,
                s.MONTHH,
                s.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                s.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                s.BEG1,
                s.IN1,
                s.OUT1,
                s.UPD1,
                s.UNIT_COST,
                s.BEG1_AMT,
                s.IN1_AMT,
                s.OUT1_AMT,
                s.UPD1_AMT,
                s.LOTNO,
                s.EXPIRE_DATE
            FROM STOCK_CARD s
            LEFT JOIN TABLE_DRUG d ON s.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON s.UNIT_CODE1 = u.UNIT_CODE
            WHERE s.MYEAR = ? AND s.MONTHH = ?
            ORDER BY s.REFNO DESC, s.DRUG_CODE`,
            [year, month]
        );

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            period: { year, month }
        });
    } catch (error) {
        console.error('Error fetching stock cards by period:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล STOCK_CARD ตามช่วงเวลา',
            error: error.message
        });
    }
});

// GET stock cards by drug code
router.get('/drug/:drugCode', async (req, res) => {
    try {
        const pool = require('../config/db');
        const { drugCode } = req.params;

        const [rows] = await pool.execute(
            `SELECT 
                s.REFNO,
                s.RDATE,
                s.TRDATE,
                s.MYEAR,
                s.MONTHH,
                s.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                s.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                s.BEG1,
                s.IN1,
                s.OUT1,
                s.UPD1,
                s.UNIT_COST,
                s.BEG1_AMT,
                s.IN1_AMT,
                s.OUT1_AMT,
                s.UPD1_AMT,
                s.LOTNO,
                s.EXPIRE_DATE
            FROM STOCK_CARD s
            LEFT JOIN TABLE_DRUG d ON s.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON s.UNIT_CODE1 = u.UNIT_CODE
            WHERE s.DRUG_CODE = ?
            ORDER BY s.MYEAR DESC, s.MONTHH DESC, s.REFNO DESC`,
            [drugCode]
        );

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            drugCode: drugCode
        });
    } catch (error) {
        console.error('Error fetching stock cards by drug:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล STOCK_CARD ตามรหัสยา',
            error: error.message
        });
    }
});

// GET stock cards by REFNO
router.get('/refno/:refno', async (req, res) => {
    try {
        const pool = require('../config/db');
        const { refno } = req.params;

        const [rows] = await pool.execute(
            `SELECT 
                s.REFNO,
                s.RDATE,
                s.TRDATE,
                s.MYEAR,
                s.MONTHH,
                s.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                s.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                s.BEG1,
                s.IN1,
                s.OUT1,
                s.UPD1,
                s.UNIT_COST,
                s.BEG1_AMT,
                s.IN1_AMT,
                s.OUT1_AMT,
                s.UPD1_AMT,
                s.LOTNO,
                s.EXPIRE_DATE
            FROM STOCK_CARD s
            LEFT JOIN TABLE_DRUG d ON s.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON s.UNIT_CODE1 = u.UNIT_CODE
            WHERE s.REFNO = ?
            ORDER BY s.DRUG_CODE`,
            [refno]
        );

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            refno: refno
        });
    } catch (error) {
        console.error('Error fetching stock cards by refno:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล STOCK_CARD ตาม REFNO',
            error: error.message
        });
    }
});

// GET specific stock card record
router.get('/:year/:month/:drugCode/:refno', async (req, res) => {
    try {
        const pool = require('../config/db');
        const { year, month, drugCode, refno } = req.params;

        const [rows] = await pool.execute(
            `SELECT 
                s.REFNO,
                s.RDATE,
                s.TRDATE,
                s.MYEAR,
                s.MONTHH,
                s.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                s.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                s.BEG1,
                s.IN1,
                s.OUT1,
                s.UPD1,
                s.UNIT_COST,
                s.BEG1_AMT,
                s.IN1_AMT,
                s.OUT1_AMT,
                s.UPD1_AMT,
                s.LOTNO,
                s.EXPIRE_DATE
            FROM STOCK_CARD s
            LEFT JOIN TABLE_DRUG d ON s.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON s.UNIT_CODE1 = u.UNIT_CODE
            WHERE s.MYEAR = ? AND s.MONTHH = ? AND s.DRUG_CODE = ? AND s.REFNO = ?`,
            [year, month, drugCode, refno]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูล STOCK_CARD'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching stock card record:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล STOCK_CARD',
            error: error.message
        });
    }
});

// Search stock card records
router.get('/search/:term', async (req, res) => {
    try {
        const pool = require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await pool.execute(`
            SELECT 
                s.REFNO,
                s.RDATE,
                s.TRDATE,
                s.MYEAR,
                s.MONTHH,
                s.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                s.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                s.BEG1,
                s.IN1,
                s.OUT1,
                s.UPD1,
                s.UNIT_COST,
                s.BEG1_AMT,
                s.IN1_AMT,
                s.OUT1_AMT,
                s.UPD1_AMT,
                s.LOTNO,
                s.EXPIRE_DATE
            FROM STOCK_CARD s
            LEFT JOIN TABLE_DRUG d ON s.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON s.UNIT_CODE1 = u.UNIT_CODE
            WHERE s.DRUG_CODE LIKE ?
               OR d.GENERIC_NAME LIKE ?
               OR d.TRADE_NAME LIKE ?
               OR s.REFNO LIKE ?
               OR s.LOTNO LIKE ?
            ORDER BY s.MYEAR DESC, s.MONTHH DESC, s.REFNO DESC, s.DRUG_CODE
        `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching stock card records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูล STOCK_CARD',
            error: error.message
        });
    }
});

// POST create new stock card record
router.post('/', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            REFNO,
            RDATE,
            TRDATE,
            MYEAR,
            MONTHH,
            DRUG_CODE,
            UNIT_CODE1,
            BEG1,
            IN1,
            OUT1,
            UPD1,
            UNIT_COST,
            BEG1_AMT,
            IN1_AMT,
            OUT1_AMT,
            UPD1_AMT,
            LOTNO,
            EXPIRE_DATE
        } = req.body;

        console.log('📝 Received data:', req.body);

        if (!REFNO || !RDATE || !MYEAR || !MONTHH || !DRUG_CODE) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ REFNO, RDATE, MYEAR, MONTHH และ DRUG_CODE'
            });
        }

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

        // ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่
        const [existing] = await connection.execute(
            'SELECT * FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? AND REFNO = ?',
            [MYEAR, MONTHH, DRUG_CODE, REFNO]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: 'มีข้อมูล STOCK_CARD นี้อยู่แล้ว'
            });
        }

        // เพิ่มข้อมูลเข้า STOCK_CARD
        console.log('📝 Inserting into STOCK_CARD...');
        await connection.execute(
            `INSERT INTO STOCK_CARD (
                REFNO, RDATE, TRDATE, MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1,
                BEG1, IN1, OUT1, UPD1, UNIT_COST,
                BEG1_AMT, IN1_AMT, OUT1_AMT, UPD1_AMT,
                LOTNO, EXPIRE_DATE
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                REFNO,
                RDATE,
                TRDATE || RDATE,
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1 || null,
                BEG1 || 0,
                IN1 || 0,
                OUT1 || 0,
                UPD1 || 0,
                UNIT_COST || 0,
                BEG1_AMT || 0,
                IN1_AMT || 0,
                OUT1_AMT || 0,
                UPD1_AMT || 0,
                LOTNO || '-',
                EXPIRE_DATE || '-'
            ]
        );
        console.log('✅ Inserted into STOCK_CARD');

        await connection.commit();
        console.log('✅ Transaction committed successfully');

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูล STOCK_CARD สำเร็จ',
            data: {
                REFNO,
                RDATE,
                TRDATE: TRDATE || RDATE,
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                BEG1,
                IN1,
                OUT1,
                UPD1,
                UNIT_COST,
                BEG1_AMT,
                IN1_AMT,
                OUT1_AMT,
                UPD1_AMT,
                LOTNO,
                EXPIRE_DATE
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error creating stock card:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.sqlMessage || error.message);

        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูล STOCK_CARD',
            error: error.message,
            code: error.code,
            sqlMessage: error.sqlMessage
        });
    } finally {
        connection.release();
    }
});

// PUT update stock card record
router.put('/:year/:month/:drugCode/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month, drugCode, refno } = req.params;
        const {
            RDATE,
            TRDATE,
            UNIT_CODE1,
            BEG1,
            IN1,
            OUT1,
            UPD1,
            UNIT_COST,
            BEG1_AMT,
            IN1_AMT,
            OUT1_AMT,
            UPD1_AMT,
            LOTNO,
            EXPIRE_DATE
        } = req.body;

        console.log('📝 Updating:', { year, month, drugCode, refno });

        // อัปเดต STOCK_CARD
        const [result] = await connection.execute(
            `UPDATE STOCK_CARD SET 
                RDATE = ?,
                TRDATE = ?,
                UNIT_CODE1 = ?,
                BEG1 = ?,
                IN1 = ?,
                OUT1 = ?,
                UPD1 = ?,
                UNIT_COST = ?,
                BEG1_AMT = ?,
                IN1_AMT = ?,
                OUT1_AMT = ?,
                UPD1_AMT = ?,
                LOTNO = ?,
                EXPIRE_DATE = ?
            WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? AND REFNO = ?`,
            [
                RDATE || null,
                TRDATE || RDATE || null,
                UNIT_CODE1 || null,
                BEG1 || 0,
                IN1 || 0,
                OUT1 || 0,
                UPD1 || 0,
                UNIT_COST || 0,
                BEG1_AMT || 0,
                IN1_AMT || 0,
                OUT1_AMT || 0,
                UPD1_AMT || 0,
                LOTNO || '-',
                EXPIRE_DATE || '-',
                year,
                month,
                drugCode,
                refno
            ]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูล STOCK_CARD ที่ต้องการแก้ไข'
            });
        }

        await connection.commit();
        console.log('✅ Stock card record updated successfully');

        res.json({
            success: true,
            message: 'แก้ไขข้อมูล STOCK_CARD สำเร็จ',
            data: {
                MYEAR: year,
                MONTHH: month,
                DRUG_CODE: drugCode,
                REFNO: refno,
                RDATE,
                TRDATE: TRDATE || RDATE,
                UNIT_CODE1,
                BEG1,
                IN1,
                OUT1,
                UPD1,
                UNIT_COST,
                BEG1_AMT,
                IN1_AMT,
                OUT1_AMT,
                UPD1_AMT,
                LOTNO,
                EXPIRE_DATE
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error updating stock card:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล STOCK_CARD',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE stock card record
router.delete('/:year/:month/:drugCode/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month, drugCode, refno } = req.params;

        console.log('🗑️ Deleting:', { year, month, drugCode, refno });

        // ลบจาก STOCK_CARD
        const [result] = await connection.execute(
            'DELETE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? AND REFNO = ?',
            [year, month, drugCode, refno]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูล STOCK_CARD ที่ต้องการลบ'
            });
        }

        await connection.commit();

        console.log('✅ Stock card record deleted successfully');

        res.json({
            success: true,
            message: 'ลบข้อมูล STOCK_CARD สำเร็จ'
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error deleting stock card:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูล STOCK_CARD',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE stock cards by REFNO
router.delete('/refno/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { refno } = req.params;

        console.log('🗑️ Deleting by REFNO:', refno);

        // ลบจาก STOCK_CARD
        const [result] = await connection.execute(
            'DELETE FROM STOCK_CARD WHERE REFNO = ?',
            [refno]
        );

        await connection.commit();

        console.log(`✅ Deleted ${result.affectedRows} stock card records`);

        res.json({
            success: true,
            message: `ลบข้อมูล STOCK_CARD ${result.affectedRows} รายการสำเร็จ`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error deleting stock cards by refno:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูล STOCK_CARD',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE all stock cards for a specific period
router.delete('/period/:year/:month', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month } = req.params;

        console.log('🗑️ Deleting period:', { year, month });

        // ลบจาก STOCK_CARD
        const [result] = await connection.execute(
            'DELETE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ?',
            [year, month]
        );

        await connection.commit();

        console.log(`✅ Deleted ${result.affectedRows} stock card records`);

        res.json({
            success: true,
            message: `ลบข้อมูล STOCK_CARD ${result.affectedRows} รายการสำเร็จ`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error deleting stock card records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูล STOCK_CARD',
            error: error.message
        });
    }
});

// ✅ GET Reverse Calculation Report (The "Work Backwards" Logic)
router.get('/reverse-report', async (req, res) => {
    try {
        const pool = require('../config/db');
        const { year, month, drugCode, lotNo } = req.query;

        console.log('🔄 Calculating Reverse Stock Report:', { year, month, drugCode, lotNo });

        if (!year || !month) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุปีและเดือน'
            });
        }

        const targetYear = parseInt(year);
        const targetMonth = parseInt(month);

        // 1. Get Current Stock Snapshot (The Absolute Truth)
        let balQuery = `
            SELECT 
                b.DRUG_CODE, 
                d.GENERIC_NAME, 
                d.TRADE_NAME,
                b.QTY as CURRENT_QTY,
                b.LOT_NO,
                b.EXPIRE_DATE,
                u.UNIT_NAME as UNIT_NAME1
            FROM BAL_DRUG b
            LEFT JOIN TABLE_DRUG d ON b.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON b.UNIT_CODE1 = u.UNIT_CODE
            WHERE 1=1
        `;

        const balParams = [];
        if (drugCode) {
            balQuery += ' AND b.DRUG_CODE = ?';
            balParams.push(drugCode);
        }
        if (lotNo) {
            if (lotNo === '-' || lotNo.toLowerCase() === 'null') {
                balQuery += " AND (b.LOT_NO IS NULL OR b.LOT_NO = '-' OR b.LOT_NO = '')";
            } else {
                balQuery += ' AND b.LOT_NO = ?';
                balParams.push(lotNo);
            }
        }

        const [currentStock] = await pool.execute(balQuery, balParams);
        console.log(`📊 Found ${currentStock.length} current stock records`);

        // 2. Get All Future Transactions (From Target Month End until NOW)
        // logic: transaction_date > last_day_of_target_month
        // But stock_card stores MYEAR/MONTHH, so we filter by (MYEAR > targetYear) OR (MYEAR = targetYear AND MONTHH > targetMonth)

        let futureQuery = `
            SELECT 
                DRUG_CODE, LOTNO,
                SUM(IN1) as TOTAL_IN,
                SUM(OUT1) as TOTAL_OUT
            FROM STOCK_CARD
            WHERE (MYEAR > ?) OR (MYEAR = ? AND MONTHH > ?)
        `;
        const futureParams = [targetYear, targetYear, targetMonth];

        if (drugCode) {
            futureQuery += ' AND DRUG_CODE = ?';
            futureParams.push(drugCode);
        }
        if (lotNo) {
            if (lotNo === '-' || lotNo.toLowerCase() === 'null') {
                futureQuery += " AND (LOTNO IS NULL OR LOTNO = '-' OR LOTNO = '')";
            } else {
                futureQuery += ' AND LOTNO = ?';
                futureParams.push(lotNo);
            }
        }

        futureQuery += ' GROUP BY DRUG_CODE, LOTNO';

        const [futureMovements] = await pool.execute(futureQuery, futureParams);

        // Map future movements for quick lookup
        const futureMap = {};
        futureMovements.forEach(m => {
            const key = `${m.DRUG_CODE}_${m.LOTNO || '-'}`;
            futureMap[key] = m;
        });

        // 3. Get Target Month Transactions (The ones we want to display)
        let targetQuery = `
             SELECT 
                s.REFNO,
                s.RDATE,
                s.TRDATE,
                s.MYEAR,
                s.MONTHH,
                s.DRUG_CODE,
                d.GENERIC_NAME,
                d.TRADE_NAME,
                s.UNIT_CODE1,
                u.UNIT_NAME as UNIT_NAME1,
                s.BEG1, -- We will ignore this and recalculate it
                s.IN1,
                s.OUT1,
                s.UPD1,
                s.UNIT_COST,
                s.BEG1_AMT,
                s.IN1_AMT,
                s.OUT1_AMT,
                s.UPD1_AMT,
                s.LOTNO,
                s.EXPIRE_DATE
            FROM STOCK_CARD s
            LEFT JOIN TABLE_DRUG d ON s.DRUG_CODE = d.DRUG_CODE
            LEFT JOIN TABLE_UNIT u ON s.UNIT_CODE1 = u.UNIT_CODE
            WHERE s.MYEAR = ? AND s.MONTHH = ?
        `;
        const targetParams = [targetYear, targetMonth];

        if (drugCode) {
            targetQuery += ' AND s.DRUG_CODE = ?';
            targetParams.push(drugCode);
        }
        if (lotNo) {
            if (lotNo === '-' || lotNo.toLowerCase() === 'null') {
                targetQuery += " AND (s.LOTNO IS NULL OR s.LOTNO = '-' OR s.LOTNO = '')";
            } else {
                targetQuery += ' AND s.LOTNO = ?';
                targetParams.push(lotNo);
            }
        }

        targetQuery += ' ORDER BY s.DRUG_CODE, s.LOTNO, s.RDATE, s.REFNO';

        const [targetTransactions] = await pool.execute(targetQuery, targetParams);

        // 4. Perform Reverse Calculation
        // result array will hold the transactions with corrected BEG1
        const resultTransactions = [];

        // We need to process by Group (Drug + Lot)
        // Let's gather all unique keys from CurrentStock AND TargetTransactions
        const allKeys = new Set();
        const stockMap = {}; // Current Stock Map

        currentStock.forEach(item => {
            const key = `${item.DRUG_CODE}_${item.LOT_NO || '-'}`;
            allKeys.add(key);
            stockMap[key] = item;
        });

        targetTransactions.forEach(tx => {
            const key = `${tx.DRUG_CODE}_${tx.LOTNO || '-'}`;
            allKeys.add(key);
        });

        // Iterate through each Drug/Lot group
        for (const key of allKeys) {
            const [dCode, lNo] = key.split('_');
            const realLot = lNo === '-' ? null : lNo;

            // 4.1 Determine Ending Balance of Target Month
            // EndBal = CurrentBal - (FutureIN - FutureOUT)
            // Actually: Current = EndBal + FutureIN - FutureOUT
            // So: EndBal = Current - FutureIN + FutureOUT

            const currentItem = stockMap[key];
            const currentQty = currentItem ? parseFloat(currentItem.CURRENT_QTY || 0) : 0;

            const futureMov = futureMap[key];
            const futureIn = futureMov ? parseFloat(futureMov.TOTAL_IN || 0) : 0;
            const futureOut = futureMov ? parseFloat(futureMov.TOTAL_OUT || 0) : 0;

            const targetMonthEndQty = currentQty - futureIn + futureOut;

            // 4.2 Calculate Beginning Balance of Target Month
            // TargetEnd = TargetStart + TargetIN - TargetOUT
            // TargetStart = TargetEnd - TargetIN + TargetOUT

            // Get transactions for this group in target month
            const groupTxs = targetTransactions.filter(t =>
                t.DRUG_CODE === dCode && (t.LOTNO || '-') === (realLot || '-')
            );

            const totalTargetIn = groupTxs.reduce((sum, t) => sum + (parseFloat(t.IN1) || 0), 0);
            const totalTargetOut = groupTxs.reduce((sum, t) => sum + (parseFloat(t.OUT1) || 0), 0);

            const targetMonthStartQty = targetMonthEndQty - totalTargetIn + totalTargetOut;

            // 4.3 Assign Calculated BEG to transactions
            // We want to return the transactions exactly as they are, but we might want to inject the "Initial BEG" 
            // so the frontend can display the running balance correctly.
            // However, the standard report format expects a list of rows. 
            // Ideally, we should insert a "Beginning Balance" row if it doesn't exist, or just return the metadata.

            // Let's modify the transactions to include the calculated running balance?
            // Or better: Just return the raw transactions, but attach the "CalculatedStartQty" to the first one?
            // Actually, the simplest way for the frontend (StockCardReport.js) to understand is if we return:
            // 1. The transactions
            // 2. A "Beginning Balance" map for each Drug/Lot

            // But wait, the Frontend likely iterates rows and expects `BEG1` column to be there.
            // If we want to fix `BEG1` in each row (which is usually the balance BEFORE that transaction), we can calculate it.

            let runningBalance = targetMonthStartQty;

            if (groupTxs.length === 0) {
                // Even if no transactions in this month, if there is a balance, we should probably return a "dummy" BEG record?
                // Standard stock card reports usually only show movements. 
                // If there's no movement but there is stock, it might show 1 line "Beginning Balance".
                if (targetMonthStartQty !== 0 || targetMonthEndQty !== 0) {
                    // create a synthetic "Beginning Balance" mock object if needed, 
                    // or rely on frontend to display "No movements, Balance: X"
                    // For now, let's push a dummy row if you want, or just handle it in frontend.
                    // Let's stick to returning transactions and let frontend handle "No Transaction" case using `summary` data.
                }
            } else {
                // Determine BEG for each transaction line (Running Balance)
                // Transaction 1: BEG = MonthStart
                // Transaction 2: BEG = MonthStart + T1.IN - T1.OUT

                for (const tx of groupTxs) {
                    tx.CALCULATED_BEG = runningBalance;
                    tx.CALCULATED_END = runningBalance + (parseFloat(tx.IN1) || 0) - (parseFloat(tx.OUT1) || 0);

                    // Update running balance for next row
                    runningBalance = tx.CALCULATED_END;

                    // Push to result
                    resultTransactions.push(tx);
                }
            }
        }

        // Sort results again
        resultTransactions.sort((a, b) => {
            if (a.DRUG_CODE !== b.DRUG_CODE) return a.DRUG_CODE.localeCompare(b.DRUG_CODE);
            if (a.RDATE !== b.RDATE) return new Date(a.RDATE) - new Date(b.RDATE);
            return 0;
        });

        res.json({
            success: true,
            data: resultTransactions,
            count: resultTransactions.length,
            period: { year, month },
            isReverseCalculation: true
        });

    } catch (error) {
        console.error('❌ Error calculating reverse stock report:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการคำนวณรายงานสต็อกย้อนหลัง',
            error: error.message
        });
    }
});

module.exports = router;

