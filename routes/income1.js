const express = require('express');
const router = express.Router();

// GET all income1 records with details
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const [rows] = await db.execute(`
            SELECT 
                i.REFNO,
                i.RDATE,
                i.TRDATE,
                i.MYEAR,
                i.MONTHH,
                i.NAME1,
                i.STATUS,
                i.TOTAL,
                i.TYPE_PAY,
                i.BANK_NO,
                ti.TYPE_INCOME_NAME
            FROM INCOME1 i
            LEFT JOIN TYPE_INCOME ti ON i.TYPE_PAY = ti.TYPE_INCOME_CODE
            ORDER BY i.REFNO DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM INCOME1');

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
        console.error('Error fetching income1 records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบสำคัญรับ',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        const [total] = await db.execute('SELECT COUNT(*) as count FROM INCOME1');
        const [totalAmount] = await db.execute('SELECT SUM(TOTAL) as sum FROM INCOME1 WHERE STATUS != "ยกเลิก"');
        const [byMonth] = await db.execute(`
            SELECT MYEAR, MONTHH, COUNT(*) as count, SUM(TOTAL) as total
            FROM INCOME1
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
        console.error('Error fetching income1 stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
            error: error.message
        });
    }
});

// GET income1 by REFNO (with details)
router.get('/:refno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { refno } = req.params;

        // Get header
        const [header] = await db.execute(`
            SELECT 
                i.*,
                ti.TYPE_INCOME_NAME
            FROM INCOME1 i
            LEFT JOIN TYPE_INCOME ti ON i.TYPE_PAY = ti.TYPE_INCOME_CODE
            WHERE i.REFNO = ?
        `, [refno]);

        if (header.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลใบสำคัญรับ'
            });
        }

        // Get details
        const [details] = await db.execute(`
            SELECT 
                id.*,
                ti.TYPE_INCOME_NAME
            FROM INCOME1_DT id
            LEFT JOIN TYPE_INCOME ti ON id.TYPE_INCOME_CODE = ti.TYPE_INCOME_CODE
            WHERE id.REFNO = ?
            ORDER BY id.TYPE_INCOME_CODE
        `, [refno]);

        res.json({
            success: true,
            data: {
                header: header[0],
                details: details
            }
        });
    } catch (error) {
        console.error('Error fetching income1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// Search income1
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT 
                i.REFNO,
                i.RDATE,
                i.TRDATE,
                i.MYEAR,
                i.MONTHH,
                i.NAME1,
                i.STATUS,
                i.TOTAL,
                i.TYPE_PAY,
                i.BANK_NO,
                ti.TYPE_INCOME_NAME
            FROM INCOME1 i
            LEFT JOIN TYPE_INCOME ti ON i.TYPE_PAY = ti.TYPE_INCOME_CODE
            WHERE i.REFNO LIKE ? 
               OR i.NAME1 LIKE ?
               OR i.BANK_NO LIKE ?
            ORDER BY i.REFNO DESC
        `, [searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching income1:', error);
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

        const prefix = `INC${currentYear}${currentMonth}`;

        const [result] = await db.execute(`
            SELECT REFNO 
            FROM INCOME1 
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

// ✅ POST create new income1 with details (แก้ใช้ getConnection)
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
            NAME1,
            STATUS,
            TYPE_PAY,
            BANK_NO,
            details // Array of detail items
        } = req.body;

        // Validate required fields
        if (!REFNO || !RDATE || !NAME1 || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุข้อมูลที่จำเป็น (REFNO, RDATE, NAME1, details)'
            });
        }

        // Calculate total from details
        const total = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);

        // Insert INCOME1 header
        await connection.execute(`
            INSERT INTO INCOME1 (
                REFNO, RDATE, TRDATE, MYEAR, MONTHH, 
                NAME1, STATUS, TOTAL, TYPE_PAY, BANK_NO
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            REFNO,
            RDATE,
            TRDATE || RDATE,
            MYEAR || new Date().getFullYear(),
            MONTHH || (new Date().getMonth() + 1),
            NAME1,
            STATUS || 'ทำงานอยู่',
            total,
            TYPE_PAY,
            BANK_NO
        ]);

        // Insert INCOME1_DT details
        for (const detail of details) {
            await connection.execute(`
                INSERT INTO INCOME1_DT (
                    REFNO, TYPE_INCOME_CODE, DESCM1, AMT
                ) VALUES (?, ?, ?, ?)
            `, [
                REFNO,
                detail.TYPE_INCOME_CODE,
                detail.DESCM1,
                detail.AMT
            ]);
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'สร้างใบสำคัญรับสำเร็จ',
            data: {
                REFNO,
                TOTAL: total,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating income1:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'เลขที่ใบสำคัญรับนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างใบสำคัญรับ',
                error: error.message
            });
        }
    } finally {
        connection.release();
    }
});

// ✅ PUT update income1 with details (แก้ใช้ getConnection)
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
            NAME1,
            STATUS,
            TYPE_PAY,
            BANK_NO,
            details
        } = req.body;

        // Validate
        if (!RDATE || !NAME1 || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุข้อมูลที่จำเป็น'
            });
        }

        // Calculate total
        const total = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);

        // Update INCOME1 header
        const [result] = await connection.execute(`
            UPDATE INCOME1 SET 
                RDATE = ?,
                TRDATE = ?,
                MYEAR = ?,
                MONTHH = ?,
                NAME1 = ?,
                STATUS = ?,
                TOTAL = ?,
                TYPE_PAY = ?,
                BANK_NO = ?
            WHERE REFNO = ?
        `, [
            RDATE,
            TRDATE || RDATE,
            MYEAR,
            MONTHH,
            NAME1,
            STATUS,
            total,
            TYPE_PAY,
            BANK_NO,
            refno
        ]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบสำคัญรับที่ต้องการแก้ไข'
            });
        }

        // Delete old details
        await connection.execute('DELETE FROM INCOME1_DT WHERE REFNO = ?', [refno]);

        // Insert new details
        for (const detail of details) {
            await connection.execute(`
                INSERT INTO INCOME1_DT (
                    REFNO, TYPE_INCOME_CODE, DESCM1, AMT
                ) VALUES (?, ?, ?, ?)
            `, [
                refno,
                detail.TYPE_INCOME_CODE,
                detail.DESCM1,
                detail.AMT
            ]);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'แก้ไขใบสำคัญรับสำเร็จ',
            data: {
                REFNO: refno,
                TOTAL: total,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating income1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไข',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// ✅ DELETE income1 (แก้ใช้ getConnection)
router.delete('/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { refno } = req.params;

        // Delete details first
        await connection.execute('DELETE FROM INCOME1_DT WHERE REFNO = ?', [refno]);

        // Delete header
        const [result] = await connection.execute('DELETE FROM INCOME1 WHERE REFNO = ?', [refno]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบสำคัญรับที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบใบสำคัญรับสำเร็จ'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting income1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบ',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// GET income1 by month/year
router.get('/period/:year/:month', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.params;

        const [rows] = await db.execute(`
            SELECT 
                i.*,
                ti.TYPE_INCOME_NAME
            FROM INCOME1 i
            LEFT JOIN TYPE_INCOME ti ON i.TYPE_PAY = ti.TYPE_INCOME_CODE
            WHERE i.MYEAR = ? AND i.MONTHH = ?
            ORDER BY i.REFNO DESC
        `, [year, parseInt(month)]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            period: { year, month }
        });
    } catch (error) {
        console.error('Error fetching income1 by period:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

module.exports = router;