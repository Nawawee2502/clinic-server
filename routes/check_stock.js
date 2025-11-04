const express = require('express');
const router = express.Router();

// GET all check_stock records with details
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const [rows] = await db.execute(`
            SELECT 
                REFNO,
                RDATE,
                TRDATE,
                MYEAR,
                MONTHH,
                STATUS,
                TOTAL
            FROM CHECK_STOCK
            ORDER BY REFNO DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM CHECK_STOCK');

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
        console.error('Error fetching check_stock records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตรวจนับสต๊อก',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        const [total] = await db.execute('SELECT COUNT(*) as count FROM CHECK_STOCK');
        const [totalAmount] = await db.execute('SELECT SUM(TOTAL) as sum FROM CHECK_STOCK WHERE STATUS != "ยกเลิก"');
        const [byMonth] = await db.execute(`
            SELECT MYEAR, MONTHH, COUNT(*) as count, SUM(TOTAL) as total
            FROM CHECK_STOCK
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
        console.error('Error fetching check_stock stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
            error: error.message
        });
    }
});

// GET check_stock by REFNO (with details)
router.get('/:refno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { refno } = req.params;

        const [header] = await db.execute(`
            SELECT *
            FROM CHECK_STOCK
            WHERE REFNO = ?
        `, [refno]);

        if (header.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลตรวจนับสต๊อก'
            });
        }

        const [details] = await db.execute(`
            SELECT *
            FROM CHECK_STOCK_DT
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
        console.error('Error fetching check_stock:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// Search check_stock
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const searchTerm = `%${term}%`;

        const [rows] = await db.execute(`
            SELECT *
            FROM CHECK_STOCK
            WHERE REFNO LIKE ? 
            ORDER BY REFNO DESC
        `, [searchTerm]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching check_stock:', error);
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

        const prefix = `CHK${currentYear}${currentMonth}`;

        const [result] = await db.execute(`
            SELECT REFNO 
            FROM CHECK_STOCK 
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

// POST create new check_stock with details
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
            STATUS,
            details
        } = req.body;

        if (!REFNO || !RDATE || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุข้อมูลที่จำเป็น (REFNO, RDATE, details)'
            });
        }

        const year = MYEAR || new Date().getFullYear();
        const month = MONTHH || (new Date().getMonth() + 1);
        const total = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);

        await connection.execute(`
            INSERT INTO CHECK_STOCK (
                REFNO, RDATE, TRDATE, MYEAR, MONTHH, STATUS, TOTAL
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            REFNO,
            RDATE,
            TRDATE || RDATE,
            year,
            month,
            STATUS || 'ทำงานอยู่',
            total
        ]);

        for (const detail of details) {
            let lotNo = detail.LOT_NO || '-';

            const qtyAdjust = (parseFloat(detail.QTY_BAL) || 0) - (parseFloat(detail.QTY_PROGRAM) || 0);
            const amt = qtyAdjust * (parseFloat(detail.UNIT_COST) || 0);

            // ✅ บันทึก LOT_NO และ EXPIRE_DATE
            await connection.execute(`
                INSERT INTO CHECK_STOCK_DT (
                    REFNO, DRUG_CODE, QTY_PROGRAM, QTY_BAL, QTY, UNIT_COST, UNIT_CODE1, AMT, LOT_NO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                REFNO,
                detail.DRUG_CODE,
                detail.QTY_PROGRAM || 0,
                detail.QTY_BAL || 0,
                qtyAdjust,
                detail.UNIT_COST,
                detail.UNIT_CODE1 || detail.UNIT_CODE,
                amt,
                detail.LOT_NO || '-',
                detail.EXPIRE_DATE
            ]);

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
                0,
                0,
                0,
                qtyAdjust,
                detail.UNIT_COST,
                0,
                0,
                amt,
                detail.LOT_NO || '-',
                detail.EXPIRE_DATE
            ]);

            // ** ✅ UPDATE BAL_DRUG ตาม LOT_NO ที่เลือก **
            lotNo = detail.LOT_NO || '-';

            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [detail.DRUG_CODE, lotNo]
            );

            if (existingBal.length > 0) {
                // มีข้อมูลอยู่แล้ว → UPDATE
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty + qtyAdjust; // ปรับปรุง
                const newAmt = oldAmt + amt;

                await connection.execute(`
                    UPDATE BAL_DRUG SET 
                        QTY = ?, 
                        AMT = ?,
                        UNIT_PRICE = ?,
                        UNIT_CODE1 = ?,
                        EXPIRE_DATE = ?,
                        TEXPIRE_DATE = ?
                    WHERE DRUG_CODE = ? AND LOT_NO = ?
                `, [
                    newQty,
                    newAmt,
                    detail.UNIT_COST,
                    detail.UNIT_CODE1 || detail.UNIT_CODE,
                    detail.EXPIRE_DATE || '-',
                    detail.EXPIRE_DATE || '-',
                    detail.DRUG_CODE,
                    lotNo
                ]);
            } else {
                // ไม่มีข้อมูล → INSERT ใหม่
                await connection.execute(`
                    INSERT INTO BAL_DRUG (
                        DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE,
                        UNIT_CODE1, QTY, UNIT_PRICE, AMT
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    detail.DRUG_CODE,
                    lotNo,
                    detail.EXPIRE_DATE || '-',
                    detail.EXPIRE_DATE || '-',
                    detail.UNIT_CODE1 || detail.UNIT_CODE,
                    qtyAdjust,
                    detail.UNIT_COST,
                    amt
                ]);
            }
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'สร้างใบตรวจนับสต๊อกสำเร็จ และอัปเดตข้อมูลใน STOCK_CARD และ BAL_DRUG แล้ว',
            data: {
                REFNO,
                TOTAL: total,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating check_stock:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'เลขที่ใบตรวจนับสต๊อกนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างใบตรวจนับสต๊อก',
                error: error.message
            });
        }
    } finally {
        connection.release();
    }
});

// PUT update check_stock with details
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
            STATUS,
            details
        } = req.body;

        if (!RDATE || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุข้อมูลที่จำเป็น'
            });
        }

        // ดึงรายการเดิมเพื่อคืนค่าใน BAL_DRUG ก่อน
        const [oldDetails] = await connection.execute(
            'SELECT DRUG_CODE, LOT_NO, QTY, AMT FROM CHECK_STOCK_DT WHERE REFNO = ?',
            [refno]
        );

        // คืนค่าใน BAL_DRUG (ลบค่าปรับปรุงเดิมออก)
        for (const oldDetail of oldDetails) {
            let lotNo = oldDetail.LOT_NO || '-';
            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [oldDetail.DRUG_CODE, lotNo]
            );

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty - (parseFloat(oldDetail.QTY) || 0); // ลบค่าปรับปรุงเดิม
                const newAmt = oldAmt - (parseFloat(oldDetail.AMT) || 0);

                await connection.execute(
                    'UPDATE BAL_DRUG SET QTY = ?, AMT = ? WHERE DRUG_CODE = ? AND LOT_NO = ?',
                    [newQty, newAmt, oldDetail.DRUG_CODE, lotNo]
                );
            }
        }

        await connection.execute('DELETE FROM STOCK_CARD WHERE REFNO = ?', [refno]);

        const total = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);

        const [result] = await connection.execute(`
            UPDATE CHECK_STOCK SET 
                RDATE = ?,
                TRDATE = ?,
                MYEAR = ?,
                MONTHH = ?,
                STATUS = ?,
                TOTAL = ?
            WHERE REFNO = ?
        `, [
            RDATE,
            TRDATE || RDATE,
            MYEAR,
            MONTHH,
            STATUS,
            total,
            refno
        ]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบตรวจนับสต๊อกที่ต้องการแก้ไข'
            });
        }

        await connection.execute('DELETE FROM CHECK_STOCK_DT WHERE REFNO = ?', [refno]);

        for (const detail of details) {
            let lotNo = detail.LOT_NO || '-';

            const qtyAdjust = (parseFloat(detail.QTY_BAL) || 0) - (parseFloat(detail.QTY_PROGRAM) || 0);
            const amt = qtyAdjust * (parseFloat(detail.UNIT_COST) || 0);

            await connection.execute(`
                INSERT INTO CHECK_STOCK_DT (
                    REFNO, DRUG_CODE, QTY_PROGRAM, QTY_BAL, QTY, UNIT_COST, UNIT_CODE1, AMT, LOT_NO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                refno,
                detail.DRUG_CODE,
                detail.QTY_PROGRAM || 0,
                detail.QTY_BAL || 0,
                qtyAdjust,
                detail.UNIT_COST,
                detail.UNIT_CODE1 || detail.UNIT_CODE,
                amt,
                detail.LOT_NO || '-',
                detail.EXPIRE_DATE
            ]);

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
                0,
                qtyAdjust,
                detail.UNIT_COST,
                0,
                0,
                amt,
                detail.LOT_NO || '-',
                detail.EXPIRE_DATE
            ]);

            // ** ✅ UPDATE BAL_DRUG ตาม LOT_NO **
            lotNo = detail.LOT_NO || '-';

            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [detail.DRUG_CODE, lotNo]
            );

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty + qtyAdjust;
                const newAmt = oldAmt + amt;

                await connection.execute(`
                    UPDATE BAL_DRUG SET 
                        QTY = ?, 
                        AMT = ?,
                        UNIT_PRICE = ?,
                        UNIT_CODE1 = ?,
                        EXPIRE_DATE = ?,
                        TEXPIRE_DATE = ?
                    WHERE DRUG_CODE = ? AND LOT_NO = ?
                `, [
                    newQty,
                    newAmt,
                    detail.UNIT_COST,
                    detail.UNIT_CODE1 || detail.UNIT_CODE,
                    detail.EXPIRE_DATE || '-',
                    detail.EXPIRE_DATE || '-',
                    detail.DRUG_CODE,
                    lotNo
                ]);
            } else {
                await connection.execute(`
                    INSERT INTO BAL_DRUG (
                        DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE,
                        UNIT_CODE1, QTY, UNIT_PRICE, AMT
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    detail.DRUG_CODE,
                    lotNo,
                    detail.EXPIRE_DATE || '-',
                    detail.EXPIRE_DATE || '-',
                    detail.UNIT_CODE1 || detail.UNIT_CODE,
                    qtyAdjust,
                    detail.UNIT_COST,
                    amt
                ]);
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'แก้ไขใบตรวจนับสต๊อกสำเร็จ และอัปเดตข้อมูลใน STOCK_CARD และ BAL_DRUG แล้ว',
            data: {
                REFNO: refno,
                TOTAL: total,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating check_stock:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไข',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE check_stock
router.delete('/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { refno } = req.params;

        // ดึงรายการเพื่อคืนค่าใน BAL_DRUG
        const [details] = await connection.execute(
            'SELECT DRUG_CODE, LOT_NO, QTY, AMT FROM CHECK_STOCK_DT WHERE REFNO = ?',
            [refno]
        );

        // คืนค่าใน BAL_DRUG (ลบค่าปรับปรุงออก)
        for (const detail of details) {
            let lotNo = detail.LOT_NO || '-';

            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [detail.DRUG_CODE, lotNo]
            );

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty - (parseFloat(detail.QTY) || 0);
                const newAmt = oldAmt - (parseFloat(detail.AMT) || 0);

                await connection.execute(
                    'UPDATE BAL_DRUG SET QTY = ?, AMT = ? WHERE DRUG_CODE = ? AND LOT_NO = ?',
                    [newQty, newAmt, detail.DRUG_CODE, lotNo]
                );
            }
        }

        await connection.execute('DELETE FROM STOCK_CARD WHERE REFNO = ?', [refno]);
        await connection.execute('DELETE FROM CHECK_STOCK_DT WHERE REFNO = ?', [refno]);

        const [result] = await connection.execute('DELETE FROM CHECK_STOCK WHERE REFNO = ?', [refno]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบตรวจนับสต๊อกที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบใบตรวจนับสต๊อกสำเร็จ และอัปเดตข้อมูลใน STOCK_CARD และ BAL_DRUG แล้ว'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting check_stock:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบ',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// GET check_stock by month/year
router.get('/period/:year/:month', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.params;

        const [rows] = await db.execute(`
            SELECT *
            FROM CHECK_STOCK
            WHERE MYEAR = ? AND MONTHH = ?
            ORDER BY REFNO DESC
        `, [year, parseInt(month)]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            period: { year, month }
        });
    } catch (error) {
        console.error('Error fetching check_stock by period:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

module.exports = router;