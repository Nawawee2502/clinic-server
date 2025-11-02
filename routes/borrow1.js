const express = require('express');
const router = express.Router();

// GET all borrow1 records with details (แก้ไข: เพิ่ม JOIN กับ EMPLOYEE1)
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const [rows] = await db.execute(`
            SELECT 
                b.REFNO,
                b.RDATE,
                b.TRDATE,
                b.MYEAR,
                b.MONTHH,
                b.EMP_CODE,
                e.EMP_NAME,
                b.STATUS,
                b.TOTAL
            FROM BORROW1 b
            LEFT JOIN EMPLOYEE1 e ON b.EMP_CODE = e.EMP_CODE
            ORDER BY b.REFNO DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM BORROW1');

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
        console.error('Error fetching borrow1 records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบเบิกสินค้า',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        const [total] = await db.execute('SELECT COUNT(*) as count FROM BORROW1');
        const [totalAmount] = await db.execute('SELECT SUM(TOTAL) as sum FROM BORROW1 WHERE STATUS != "ยกเลิก"');
        const [byMonth] = await db.execute(`
            SELECT MYEAR, MONTHH, COUNT(*) as count, SUM(TOTAL) as total
            FROM BORROW1
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
        console.error('Error fetching borrow1 stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
            error: error.message
        });
    }
});

// GET borrow1 by REFNO (with details) - แก้ไข: เพิ่ม JOIN กับ EMPLOYEE1
router.get('/:refno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { refno } = req.params;

        const [header] = await db.execute(`
            SELECT 
                b.*,
                e.EMP_NAME
            FROM BORROW1 b
            LEFT JOIN EMPLOYEE1 e ON b.EMP_CODE = e.EMP_CODE
            WHERE b.REFNO = ?
        `, [refno]);

        if (header.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลใบเบิกสินค้า'
            });
        }

        const [details] = await db.execute(`
            SELECT *
            FROM BORROW1_DT
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
        console.error('Error fetching borrow1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// Search borrow1 - แก้ไข: เพิ่ม JOIN กับ EMPLOYEE1 และค้นหาชื่อพนักงานด้วย
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT 
                b.*,
                e.EMP_NAME
            FROM BORROW1 b
            LEFT JOIN EMPLOYEE1 e ON b.EMP_CODE = e.EMP_CODE
            WHERE b.REFNO LIKE ? 
               OR b.EMP_CODE LIKE ?
               OR e.EMP_NAME LIKE ?
            ORDER BY b.REFNO DESC
        `, [searchTerm, searchTerm, searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching borrow1:', error);
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

        const prefix = `BOR${currentYear}${currentMonth}`;

        const [result] = await db.execute(`
            SELECT REFNO 
            FROM BORROW1 
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

// POST create new borrow1 with details
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
            EMP_CODE,
            STATUS,
            details
        } = req.body;

        if (!REFNO || !RDATE || !EMP_CODE || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุข้อมูลที่จำเป็น (REFNO, RDATE, EMP_CODE, details)'
            });
        }

        const year = MYEAR || new Date().getFullYear();
        const month = MONTHH || (new Date().getMonth() + 1);
        const total = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);

        await connection.execute(`
            INSERT INTO BORROW1 (
                REFNO, RDATE, TRDATE, MYEAR, MONTHH, EMP_CODE, STATUS, TOTAL
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            REFNO,
            RDATE,
            TRDATE || RDATE,
            year,
            month,
            EMP_CODE,
            STATUS || 'ทำงานอยู่',
            total
        ]);

        for (const detail of details) {
            await connection.execute(`
                INSERT INTO BORROW1_DT (
                    REFNO, DRUG_CODE, QTY, UNIT_COST, UNIT_CODE1, AMT, LOT_NO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                REFNO,
                detail.DRUG_CODE,
                detail.QTY,
                detail.UNIT_COST,
                detail.UNIT_CODE1 || detail.UNIT_CODE,
                detail.AMT,
                detail.LOT_NO,
                detail.EXPIRE_DATE
            ]);

            // ** เพิ่มข้อมูลใน STOCK_CARD (INSERT ใหม่ทุกครั้ง) - ใบเบิกเป็นการออก **
            await connection.execute(`
                INSERT INTO STOCK_CARD (
                    REFNO, RDATE, TRDATE, MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1,
                    BEG1, IN1, OUT1, UPD1, UNIT_COST, IN1_AMT, OUT1_AMT, UPD1_AMT, LOTNO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                REFNO,
                RDATE,
                TRDATE || RDATE,
                year,
                month,
                detail.DRUG_CODE,
                detail.UNIT_CODE1 || detail.UNIT_CODE,
                0, // BEG1
                0, // IN1
                detail.QTY, // OUT1 - เบิกออก
                0, // UPD1
                detail.UNIT_COST,
                0, // IN1_AMT
                detail.AMT, // OUT1_AMT - เบิกออก
                0, // UPD1_AMT
                detail.LOT_NO,
                detail.EXPIRE_DATE
            ]);

            // ** ✅ แก้ไข: ใบเบิก = ลดจำนวนใน BAL_DRUG (เหมือน return1) **
            // ดึงข้อมูลเดิมจาก BAL_DRUG
            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? ORDER BY QTY DESC LIMIT 1',
                [detail.DRUG_CODE, detail.LOT_NO || '-']
            );

            let newQty = -(parseFloat(detail.QTY) || 0); // ลบออก (เบิกสินค้า = ลดจำนวน)
            let newAmt = -(parseFloat(detail.AMT) || 0); // ลบออก

            // ถ้ามีข้อมูลเดิม ให้คำนวณลบออก (เบิกสินค้า = ลด)
            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                newQty = oldQty - (parseFloat(detail.QTY) || 0); // ⭐ ลบออก
                newAmt = oldAmt - (parseFloat(detail.AMT) || 0); // ⭐ ลบออก
            }

            // INSERT ใหม่เข้า BAL_DRUG
            await connection.execute(`
                INSERT INTO BAL_DRUG (
                    DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE,
                    UNIT_CODE1, QTY, UNIT_PRICE, AMT
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                detail.DRUG_CODE,
                detail.LOT_NO || '-',
                detail.EXPIRE_DATE || '-',
                detail.EXPIRE_DATE || '-',
                detail.UNIT_CODE1 || detail.UNIT_CODE,
                newQty, // ⭐ ลดจำนวน
                detail.UNIT_COST,
                newAmt  // ⭐ ลดมูลค่า
            ]);
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'สร้างใบเบิกสินค้าสำเร็จ และลดจำนวนใน BAL_DRUG แล้ว',
            data: {
                REFNO,
                TOTAL: total,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating borrow1:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'เลขที่ใบเบิกสินค้านี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างใบเบิกสินค้า',
                error: error.message
            });
        }
    } finally {
        connection.release();
    }
});

// PUT update borrow1 with details
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
            EMP_CODE,
            STATUS,
            details
        } = req.body;

        if (!RDATE || !EMP_CODE || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุข้อมูลที่จำเป็น'
            });
        }

        // ดึงรายการ DRUG_CODE และ LOT_NO เดิมก่อนลบ
        const [oldDetails] = await connection.execute(
            'SELECT DRUG_CODE, LOT_NO FROM BORROW1_DT WHERE REFNO = ?',
            [refno]
        );

        // ลบข้อมูลใน STOCK_CARD ที่เกี่ยวข้องกับ REFNO นี้ก่อน
        await connection.execute('DELETE FROM STOCK_CARD WHERE REFNO = ?', [refno]);

        // ลบ BAL_DRUG ของ DRUG_CODE และ LOT_NO เดิม
        for (const oldDetail of oldDetails) {
            await connection.execute(
                'DELETE FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [oldDetail.DRUG_CODE, oldDetail.LOT_NO || '-']
            );
        }

        const total = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);

        const [result] = await connection.execute(`
            UPDATE BORROW1 SET 
                RDATE = ?,
                TRDATE = ?,
                MYEAR = ?,
                MONTHH = ?,
                EMP_CODE = ?,
                STATUS = ?,
                TOTAL = ?
            WHERE REFNO = ?
        `, [
            RDATE,
            TRDATE || RDATE,
            MYEAR,
            MONTHH,
            EMP_CODE,
            STATUS,
            total,
            refno
        ]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบเบิกสินค้าที่ต้องการแก้ไข'
            });
        }

        await connection.execute('DELETE FROM BORROW1_DT WHERE REFNO = ?', [refno]);

        for (const detail of details) {
            await connection.execute(`
                INSERT INTO BORROW1_DT (
                    REFNO, DRUG_CODE, QTY, UNIT_COST, UNIT_CODE1, AMT, LOT_NO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                refno,
                detail.DRUG_CODE,
                detail.QTY,
                detail.UNIT_COST,
                detail.UNIT_CODE1 || detail.UNIT_CODE,
                detail.AMT,
                detail.LOT_NO,
                detail.EXPIRE_DATE
            ]);

            // ** เพิ่มข้อมูลใน STOCK_CARD (INSERT ใหม่ทุกครั้ง) **
            await connection.execute(`
                INSERT INTO STOCK_CARD (
                    REFNO, RDATE, TRDATE, MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1,
                    BEG1, IN1, OUT1, UPD1, UNIT_COST, IN1_AMT, OUT1_AMT, UPD1_AMT, LOTNO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                refno,
                RDATE,
                TRDATE || RDATE,
                MYEAR,
                MONTHH,
                detail.DRUG_CODE,
                detail.UNIT_CODE1 || detail.UNIT_CODE,
                0,
                0,
                detail.QTY,
                0,
                detail.UNIT_COST,
                0,
                detail.AMT,
                0,
                detail.LOT_NO,
                detail.EXPIRE_DATE
            ]);

            // ** ✅ แก้ไข: ใบเบิก = ลดจำนวนใน BAL_DRUG **
            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? ORDER BY QTY DESC LIMIT 1',
                [detail.DRUG_CODE, detail.LOT_NO || '-']
            );

            let newQty = -(parseFloat(detail.QTY) || 0);
            let newAmt = -(parseFloat(detail.AMT) || 0);

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                newQty = oldQty - (parseFloat(detail.QTY) || 0); // ⭐ ลบออก
                newAmt = oldAmt - (parseFloat(detail.AMT) || 0); // ⭐ ลบออก
            }

            await connection.execute(`
                INSERT INTO BAL_DRUG (
                    DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE,
                    UNIT_CODE1, QTY, UNIT_PRICE, AMT
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                detail.DRUG_CODE,
                detail.LOT_NO || '-',
                detail.EXPIRE_DATE || '-',
                detail.EXPIRE_DATE || '-',
                detail.UNIT_CODE1 || detail.UNIT_CODE,
                newQty,
                detail.UNIT_COST,
                newAmt
            ]);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'แก้ไขใบเบิกสินค้าสำเร็จ และลดจำนวนใน BAL_DRUG แล้ว',
            data: {
                REFNO: refno,
                TOTAL: total,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating borrow1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไข',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE borrow1
router.delete('/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { refno } = req.params;

        // ดึงรายการ DRUG_CODE และ LOT_NO ก่อนลบ
        const [details] = await connection.execute(
            'SELECT DRUG_CODE, LOT_NO FROM BORROW1_DT WHERE REFNO = ?',
            [refno]
        );

        // ลบข้อมูลใน STOCK_CARD ที่เกี่ยวข้องกับ REFNO นี้
        await connection.execute('DELETE FROM STOCK_CARD WHERE REFNO = ?', [refno]);

        // ลบข้อมูลใน BAL_DRUG
        for (const detail of details) {
            await connection.execute(
                'DELETE FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [detail.DRUG_CODE, detail.LOT_NO || '-']
            );
        }

        await connection.execute('DELETE FROM BORROW1_DT WHERE REFNO = ?', [refno]);

        const [result] = await connection.execute('DELETE FROM BORROW1 WHERE REFNO = ?', [refno]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบเบิกสินค้าที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบใบเบิกสินค้าสำเร็จ และลบข้อมูลใน STOCK_CARD และ BAL_DRUG แล้ว'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting borrow1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบ',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// GET borrow1 by month/year - แก้ไข: เพิ่ม JOIN กับ EMPLOYEE1
router.get('/period/:year/:month', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.params;

        const [rows] = await db.execute(`
            SELECT 
                b.*,
                e.EMP_NAME
            FROM BORROW1 b
            LEFT JOIN EMPLOYEE1 e ON b.EMP_CODE = e.EMP_CODE
            WHERE b.MYEAR = ? AND b.MONTHH = ?
            ORDER BY b.REFNO DESC
        `, [year, parseInt(month)]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            period: { year, month }
        });
    } catch (error) {
        console.error('Error fetching borrow1 by period:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

module.exports = router;