const express = require('express');
const router = express.Router();

// GET all STOCK_CARD records with optional filters
router.get('/', async (req, res) => {
    try {
        const pool = require('../config/db');
        const { year, month, drugCode, refno } = req.query;

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
    } finally {
        connection.release();
    }
});

module.exports = router;

