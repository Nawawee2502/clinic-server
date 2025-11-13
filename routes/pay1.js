const express = require('express');
const router = express.Router();

// GET all pay1 records with details
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const [rows] = await db.execute(`
            SELECT 
                p.REFNO,
                p.RDATE,
                p.TRDATE,
                p.MYEAR,
                p.MONTHH,
                p.NAME1,
                p.STATUS,
                p.TOTAL,
                p.TYPE_PAY,
                p.BANK_NO,
                tp.type_pay_name
            FROM PAY1 p
            LEFT JOIN TYPE_PAY tp ON p.TYPE_PAY = tp.type_pay_code
            ORDER BY p.REFNO DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM PAY1');

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
        console.error('Error fetching pay1 records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบสำคัญจ่าย',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        const [total] = await db.execute('SELECT COUNT(*) as count FROM PAY1');
        const [totalAmount] = await db.execute('SELECT SUM(TOTAL) as sum FROM PAY1 WHERE STATUS != "ยกเลิก"');
        const [byMonth] = await db.execute(`
            SELECT MYEAR, MONTHH, COUNT(*) as count, SUM(TOTAL) as total
            FROM PAY1
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
        console.error('Error fetching pay1 stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
            error: error.message
        });
    }
});

// GET pay1 by REFNO (with details)
router.get('/:refno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { refno } = req.params;

        // Get header
        const [header] = await db.execute(`
            SELECT 
                p.*,
                tp.type_pay_name
            FROM PAY1 p
            LEFT JOIN TYPE_PAY tp ON p.TYPE_PAY = tp.type_pay_code
            WHERE p.REFNO = ?
        `, [refno]);

        if (header.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลใบสำคัญจ่าย'
            });
        }

        // Get details
        const [details] = await db.execute(`
            SELECT 
                pd.*,
                tp.type_pay_name
            FROM PAY1_DT pd
            LEFT JOIN TYPE_PAY tp ON pd.TYPE_PAY_CODE = tp.type_pay_code
            WHERE pd.REFNO = ?
            ORDER BY pd.TYPE_PAY_CODE
        `, [refno]);

        res.json({
            success: true,
            data: {
                header: header[0],
                details: details
            }
        });
    } catch (error) {
        console.error('Error fetching pay1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// Search pay1
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT 
                p.REFNO,
                p.RDATE,
                p.TRDATE,
                p.MYEAR,
                p.MONTHH,
                p.NAME1,
                p.STATUS,
                p.TOTAL,
                p.TYPE_PAY,
                p.BANK_NO,
                tp.type_pay_name
            FROM PAY1 p
            LEFT JOIN TYPE_PAY tp ON p.TYPE_PAY = tp.type_pay_code
            WHERE p.REFNO LIKE ? 
               OR p.NAME1 LIKE ?
               OR p.BANK_NO LIKE ?
            ORDER BY p.REFNO DESC
        `, [searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching pay1:', error);
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

        const prefix = `PAY${currentYear}${currentMonth}`;

        const [result] = await db.execute(`
            SELECT REFNO 
            FROM PAY1 
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

// ✅ POST create new pay1 with details (แก้ใช้ getConnection)
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

        // Insert PAY1 header
        await connection.execute(`
            INSERT INTO PAY1 (
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

        // Insert PAY1_DT details
        for (const detail of details) {
            await connection.execute(`
                INSERT INTO PAY1_DT (
                    REFNO, TYPE_PAY_CODE, DESCM1, AMT
                ) VALUES (?, ?, ?, ?)
            `, [
                REFNO,
                detail.TYPE_PAY_CODE,
                detail.DESCM1,
                detail.AMT
            ]);
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'สร้างใบสำคัญจ่ายสำเร็จ',
            data: {
                REFNO,
                TOTAL: total,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating pay1:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'เลขที่ใบสำคัญจ่ายนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างใบสำคัญจ่าย',
                error: error.message
            });
        }
    } finally {
        connection.release();
    }
});

// ✅ PUT update pay1 with details (แก้ใช้ getConnection)
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

        // Update PAY1 header
        const [result] = await connection.execute(`
            UPDATE PAY1 SET 
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
                message: 'ไม่พบใบสำคัญจ่ายที่ต้องการแก้ไข'
            });
        }

        // Delete old details
        await connection.execute('DELETE FROM PAY1_DT WHERE REFNO = ?', [refno]);

        // Insert new details
        for (const detail of details) {
            await connection.execute(`
                INSERT INTO PAY1_DT (
                    REFNO, TYPE_PAY_CODE, DESCM1, AMT
                ) VALUES (?, ?, ?, ?)
            `, [
                refno,
                detail.TYPE_PAY_CODE,
                detail.DESCM1,
                detail.AMT
            ]);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'แก้ไขใบสำคัญจ่ายสำเร็จ',
            data: {
                REFNO: refno,
                TOTAL: total,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating pay1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไข',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// ✅ DELETE pay1 (แก้ใช้ getConnection)
router.delete('/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { refno } = req.params;

        // Delete details first
        await connection.execute('DELETE FROM PAY1_DT WHERE REFNO = ?', [refno]);

        // Delete header
        const [result] = await connection.execute('DELETE FROM PAY1 WHERE REFNO = ?', [refno]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบสำคัญจ่ายที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบใบสำคัญจ่ายสำเร็จ'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting pay1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบ',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// GET pay1 by month/year
router.get('/period/:year/:month', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.params;

        const [rows] = await db.execute(`
            SELECT 
                p.*,
                tp.type_pay_name
            FROM PAY1 p
            LEFT JOIN TYPE_PAY tp ON p.TYPE_PAY = tp.type_pay_code
            WHERE p.MYEAR = ? AND p.MONTHH = ?
            ORDER BY p.REFNO DESC
        `, [year, parseInt(month)]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            period: { year, month }
        });
    } catch (error) {
        console.error('Error fetching pay1 by period:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// GET pay1 expenses with details joined (for Expenses report)
router.get('/expenses/report', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month, status = 'ทำงานอยู่' } = req.query;

        let query = `
            SELECT 
                p.REFNO,
                p.RDATE,
                p.TRDATE,
                p.MYEAR,
                p.MONTHH,
                p.NAME1,
                p.STATUS,
                p.TYPE_PAY,
                p.BANK_NO,
                pd.TYPE_PAY_CODE,
                pd.DESCM1,
                pd.AMT,
                tp.type_pay_name
            FROM PAY1 p
            INNER JOIN PAY1_DT pd ON p.REFNO = pd.REFNO
            LEFT JOIN TYPE_PAY tp ON pd.TYPE_PAY_CODE = tp.type_pay_code
            WHERE p.STATUS = ?
        `;
        
        const params = [status];

        if (year) {
            query += ` AND p.MYEAR = ?`;
            params.push(year);
        }

        if (month) {
            query += ` AND p.MONTHH = ?`;
            params.push(parseInt(month));
        }

        query += ` ORDER BY pd.TYPE_PAY_CODE, p.REFNO`;

        const [rows] = await db.execute(query, params);

        // Group by REFNO to reconstruct the header structure
        const groupedData = {};
        rows.forEach(row => {
            if (!groupedData[row.REFNO]) {
                groupedData[row.REFNO] = {
                    REFNO: row.REFNO,
                    RDATE: row.RDATE,
                    TRDATE: row.TRDATE,
                    MYEAR: row.MYEAR,
                    MONTHH: row.MONTHH,
                    NAME1: row.NAME1,
                    STATUS: row.STATUS,
                    TYPE_PAY: row.TYPE_PAY,
                    BANK_NO: row.BANK_NO,
                    TOTAL: 0,
                    details: []
                };
            }
            groupedData[row.REFNO].details.push({
                TYPE_PAY_CODE: row.TYPE_PAY_CODE,
                DESCM1: row.DESCM1,
                AMT: parseFloat(row.AMT) || 0,
                TYPE_PAY_NAME: row.type_pay_name
            });
            groupedData[row.REFNO].TOTAL += parseFloat(row.AMT) || 0;
        });

        // Convert to array format
        const result = Object.values(groupedData);

        res.json({
            success: true,
            data: result,
            count: result.length
        });
    } catch (error) {
        console.error('Error fetching pay1 expenses report:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายจ่าย',
            error: error.message
        });
    }
});

module.exports = router;