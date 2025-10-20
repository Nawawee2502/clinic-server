const express = require('express');
const router = express.Router();

// GET all return1 records with details
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const [rows] = await db.execute(`
            SELECT 
                r.REFNO,
                r.RDATE,
                r.TRDATE,
                r.MYEAR,
                r.MONTHH,
                r.SUPPLIER_CODE,
                r.DUEDATE,
                r.STATUS,
                r.TOTAL,
                r.VAT1,
                r.VAMT,
                r.GTOTAL,
                r.TYPE_PAY,
                r.BANK_NO,
                tp.type_pay_name
            FROM RETURN1 r
            LEFT JOIN TYPE_PAY tp ON r.TYPE_PAY = tp.type_pay_code
            ORDER BY r.REFNO DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM RETURN1');

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
        console.error('Error fetching return1 records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบคืนสินค้า',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        const [total] = await db.execute('SELECT COUNT(*) as count FROM RETURN1');
        const [totalAmount] = await db.execute('SELECT SUM(GTOTAL) as sum FROM RETURN1 WHERE STATUS != "ยกเลิก"');
        const [byMonth] = await db.execute(`
            SELECT MYEAR, MONTHH, COUNT(*) as count, SUM(GTOTAL) as total
            FROM RETURN1
            WHERE STATUS != "ยกเลิก"
            GROUP BY MYEAR, MONTHH
            ORDER BY MYEAR DESC, MONTHH DESC
            LIMIT 12
        `);

        res.json({
            success: true,
            data: {
                totalRecords: total[0].count,
                totalAmount: totalAmount[0].sum || 0,
                byMonth: byMonth,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching return1 stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
            error: error.message
        });
    }
});

// GET return1 by REFNO (with details)
router.get('/:refno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { refno } = req.params;

        const [header] = await db.execute(`
            SELECT 
                r.*,
                tp.type_pay_name
            FROM RETURN1 r
            LEFT JOIN TYPE_PAY tp ON r.TYPE_PAY = tp.type_pay_code
            WHERE r.REFNO = ?
        `, [refno]);

        if (header.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลใบคืนสินค้า'
            });
        }

        const [details] = await db.execute(`
            SELECT *
            FROM RETURN1_DT
            WHERE REFNO = ?
            ORDER BY DRUG_CODE
        `, [refno]);

        res.json({
            success: true,
            data: {
                header: header[0],
                details: details
            }
        });
    } catch (error) {
        console.error('Error fetching return1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// Search return1
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT 
                r.*,
                tp.type_pay_name
            FROM RETURN1 r
            LEFT JOIN TYPE_PAY tp ON r.TYPE_PAY = tp.type_pay_code
            WHERE r.REFNO LIKE ? 
               OR r.SUPPLIER_CODE LIKE ?
               OR r.BANK_NO LIKE ?
            ORDER BY r.REFNO DESC
        `, [searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching return1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหา',
            error: error.message
        });
    }
});

// Generate next REFNO
router.get('/generate/refno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.query;

        const currentYear = year || new Date().getFullYear().toString();
        const currentMonth = month || (new Date().getMonth() + 1).toString().padStart(2, '0');

        const prefix = `RET${currentYear}${currentMonth}`;

        const [result] = await db.execute(`
            SELECT REFNO 
            FROM RETURN1 
            WHERE REFNO LIKE ?
            ORDER BY REFNO DESC 
            LIMIT 1
        `, [`${prefix}%`]);

        let nextNumber = 1;
        if (result.length > 0) {
            const lastRefno = result[0].REFNO;
            const lastNumber = parseInt(lastRefno.substring(prefix.length));
            nextNumber = lastNumber + 1;
        }

        const newRefno = prefix + nextNumber.toString().padStart(4, '0');

        res.json({
            success: true,
            data: {
                refno: newRefno,
                year: currentYear,
                month: currentMonth
            }
        });
    } catch (error) {
        console.error('Error generating refno:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างเลขที่',
            error: error.message
        });
    }
});

// POST create new return1 with details
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
            SUPPLIER_CODE,
            DUEDATE,
            STATUS,
            VAT1,
            TYPE_PAY,
            BANK_NO,
            details
        } = req.body;

        if (!REFNO || !RDATE || !SUPPLIER_CODE || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุข้อมูลที่จำเป็น (REFNO, RDATE, SUPPLIER_CODE, details)'
            });
        }

        const total = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);
        const vatRate = VAT1 || 7;
        const vamt = total * (vatRate / 100);
        const gtotal = total + vamt;

        await connection.execute(`
            INSERT INTO RETURN1 (
                REFNO, RDATE, TRDATE, MYEAR, MONTHH, 
                SUPPLIER_CODE, DUEDATE, STATUS, TOTAL, VAT1, VAMT, GTOTAL,
                TYPE_PAY, BANK_NO, PAY1
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            REFNO,
            RDATE,
            TRDATE || RDATE,
            MYEAR || new Date().getFullYear(),
            MONTHH || (new Date().getMonth() + 1),
            SUPPLIER_CODE,
            DUEDATE,
            STATUS || 'ทำงานอยู่',
            total,
            vatRate,
            vamt,
            gtotal,
            TYPE_PAY,
            BANK_NO,
            0.00
        ]);

        for (const detail of details) {
            await connection.execute(`
                INSERT INTO RETURN1_DT (
                    REFNO, DRUG_CODE, QTY, UNIT_COST, UNIT_CODE1, AMT, LOT_NO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                REFNO,
                detail.DRUG_CODE,
                detail.QTY,
                detail.UNIT_COST,
                detail.UNIT_CODE1,
                detail.AMT,
                detail.LOT_NO,
                detail.EXPIRE_DATE
            ]);
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'สร้างใบคืนสินค้าสำเร็จ',
            data: {
                REFNO,
                TOTAL: total,
                GTOTAL: gtotal,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating return1:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'เลขที่ใบคืนสินค้านี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างใบคืนสินค้า',
                error: error.message
            });
        }
    } finally {
        connection.release();
    }
});

// PUT update return1 with details
router.put('/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { refno } = req.params;
        const {
            RDATE,
            TRDATE,
            MYEAR,
            MONTHH,
            SUPPLIER_CODE,
            DUEDATE,
            STATUS,
            VAT1,
            TYPE_PAY,
            BANK_NO,
            details
        } = req.body;

        if (!RDATE || !SUPPLIER_CODE || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุข้อมูลที่จำเป็น'
            });
        }

        const total = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);
        const vatRate = VAT1 || 7;
        const vamt = total * (vatRate / 100);
        const gtotal = total + vamt;

        const [result] = await connection.execute(`
            UPDATE RETURN1 SET 
                RDATE = ?,
                TRDATE = ?,
                MYEAR = ?,
                MONTHH = ?,
                SUPPLIER_CODE = ?,
                DUEDATE = ?,
                STATUS = ?,
                TOTAL = ?,
                VAT1 = ?,
                VAMT = ?,
                GTOTAL = ?,
                TYPE_PAY = ?,
                BANK_NO = ?
            WHERE REFNO = ?
        `, [
            RDATE,
            TRDATE || RDATE,
            MYEAR,
            MONTHH,
            SUPPLIER_CODE,
            DUEDATE,
            STATUS,
            total,
            vatRate,
            vamt,
            gtotal,
            TYPE_PAY,
            BANK_NO,
            refno
        ]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบคืนสินค้าที่ต้องการแก้ไข'
            });
        }

        await connection.execute('DELETE FROM RETURN1_DT WHERE REFNO = ?', [refno]);

        for (const detail of details) {
            await connection.execute(`
                INSERT INTO RETURN1_DT (
                    REFNO, DRUG_CODE, QTY, UNIT_COST, UNIT_CODE1, AMT, LOT_NO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                refno,
                detail.DRUG_CODE,
                detail.QTY,
                detail.UNIT_COST,
                detail.UNIT_CODE1,
                detail.AMT,
                detail.LOT_NO,
                detail.EXPIRE_DATE
            ]);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'แก้ไขใบคืนสินค้าสำเร็จ',
            data: {
                REFNO: refno,
                TOTAL: total,
                GTOTAL: gtotal,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating return1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไข',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE return1
router.delete('/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { refno } = req.params;

        await connection.execute('DELETE FROM RETURN1_DT WHERE REFNO = ?', [refno]);

        const [result] = await connection.execute('DELETE FROM RETURN1 WHERE REFNO = ?', [refno]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบคืนสินค้าที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบใบคืนสินค้าสำเร็จ'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting return1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบ',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// GET return1 by month/year
router.get('/period/:year/:month', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.params;

        const [rows] = await db.execute(`
            SELECT 
                r.*,
                tp.type_pay_name
            FROM RETURN1 r
            LEFT JOIN TYPE_PAY tp ON r.TYPE_PAY = tp.type_pay_code
            WHERE r.MYEAR = ? AND r.MONTHH = ?
            ORDER BY r.REFNO DESC
        `, [year, parseInt(month)]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            period: { year, month }
        });
    } catch (error) {
        console.error('Error fetching return1 by period:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

module.exports = router;