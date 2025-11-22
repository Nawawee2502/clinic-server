const express = require('express');
const router = express.Router();

// GET all receipt1 records with details
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
                r.TYPE_VAT,
                r.VAMT,
                r.GTOTAL,
                r.TYPE_PAY,
                r.BANK_NO,
                tp.type_pay_name
            FROM RECEIPT1 r
            LEFT JOIN TYPE_PAY tp ON r.TYPE_PAY = tp.type_pay_code
            ORDER BY r.REFNO DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM RECEIPT1');

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
        console.error('Error fetching receipt1 records:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบรับสินค้า',
            error: error.message
        });
    }
});

// GET statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        const [total] = await db.execute('SELECT COUNT(*) as count FROM RECEIPT1');
        const [totalAmount] = await db.execute('SELECT SUM(GTOTAL) as sum FROM RECEIPT1 WHERE STATUS != "ยกเลิก"');
        const [byMonth] = await db.execute(`
            SELECT MYEAR, MONTHH, COUNT(*) as count, SUM(GTOTAL) as total
            FROM RECEIPT1
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
        console.error('Error fetching receipt1 stats:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
            error: error.message
        });
    }
});

// GET receipt1 by REFNO (with details)
router.get('/:refno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { refno } = req.params;

        const [header] = await db.execute(`
            SELECT 
                r.*,
                tp.type_pay_name
            FROM RECEIPT1 r
            LEFT JOIN TYPE_PAY tp ON r.TYPE_PAY = tp.type_pay_code
            WHERE r.REFNO = ?
        `, [refno]);

        if (header.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลใบรับสินค้า'
            });
        }

        const [details] = await db.execute(`
            SELECT *
            FROM RECEIPT1_DT
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
        console.error('Error fetching receipt1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// Search receipt1 (รองรับค้นหาตามวันที่)
router.get('/search/:term', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { term } = req.params;
        const { dateFrom, dateTo } = req.query;

        let query = `
            SELECT 
                r.*,
                tp.type_pay_name
            FROM RECEIPT1 r
            LEFT JOIN TYPE_PAY tp ON r.TYPE_PAY = tp.type_pay_code
            WHERE (r.REFNO LIKE ? 
               OR r.SUPPLIER_CODE LIKE ?
               OR r.BANK_NO LIKE ?)
        `;

        const params = [`%${term}%`, `%${term}%`, `%${term}%`];

        if (dateFrom) {
            query += ` AND r.RDATE >= ?`;
            params.push(dateFrom);
        }

        if (dateTo) {
            query += ` AND r.RDATE <= ?`;
            params.push(dateTo);
        }

        query += ` ORDER BY r.REFNO DESC`;

        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            searchTerm: term
        });
    } catch (error) {
        console.error('Error searching receipt1:', error);
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

        const prefix = `REC${currentYear}${currentMonth}`;

        const [result] = await db.execute(`
            SELECT REFNO 
            FROM RECEIPT1 
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

// POST create new receipt1 with details
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
            TYPE_VAT,
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

        const year = MYEAR || new Date().getFullYear();
        const month = MONTHH || (new Date().getMonth() + 1);

        const detailTotal = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);
        const vatRate = parseFloat(VAT1) || 0;
        const typeVat = TYPE_VAT || 'include';

        let total, vamt, gtotal;

        // ✅ ถ้า VAT1 เป็น 0% ให้ไม่คำนวณ VAT
        if (vatRate === 0) {
            total = detailTotal;
            vamt = 0;
            gtotal = detailTotal;
        } else {
            if (typeVat === 'include') {
                gtotal = detailTotal;
                vamt = (detailTotal * vatRate) / (100 + vatRate);
                total = detailTotal - vamt;
            } else {
                total = detailTotal;
                vamt = total * (vatRate / 100);
                gtotal = total + vamt;
            }
        }

        await connection.execute(`
            INSERT INTO RECEIPT1 (
                REFNO, RDATE, TRDATE, MYEAR, MONTHH, 
                SUPPLIER_CODE, DUEDATE, STATUS, TOTAL, VAT1, TYPE_VAT, VAMT, GTOTAL,
                TYPE_PAY, BANK_NO, PAY1
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            REFNO,
            RDATE,
            TRDATE || RDATE,
            year,
            month,
            SUPPLIER_CODE,
            DUEDATE,
            STATUS || 'ทำงานอยู่',
            total,
            vatRate,
            typeVat,
            vamt,
            gtotal,
            TYPE_PAY,
            BANK_NO,
            0.00
        ]);

        for (const detail of details) {
            await connection.execute(`
                INSERT INTO RECEIPT1_DT (
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
                detail.QTY, // IN1
                0,
                0,
                detail.UNIT_COST,
                detail.AMT, // IN1_AMT
                0,
                0,
                detail.LOT_NO,
                detail.EXPIRE_DATE
            ]);

            // ** ✅ แก้ไข: UPDATE BAL_DRUG ถ้ามียาและ LOT_NO เดียวกัน **
            const lotNo = detail.LOT_NO || '-';

            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [detail.DRUG_CODE, lotNo]
            );

            if (existingBal.length > 0) {
                // มีข้อมูลอยู่แล้ว → UPDATE
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty + (parseFloat(detail.QTY) || 0); // ใบรับ = เพิ่มจำนวน
                const newAmt = oldAmt + (parseFloat(detail.AMT) || 0);

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
                    parseFloat(detail.QTY) || 0,
                    detail.UNIT_COST,
                    parseFloat(detail.AMT) || 0
                ]);
            }
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'สร้างใบรับสินค้าสำเร็จ และอัปเดตข้อมูลใน STOCK_CARD และ BAL_DRUG แล้ว',
            data: {
                REFNO,
                TOTAL: total,
                GTOTAL: gtotal,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating receipt1:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'เลขที่ใบรับสินค้านี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างใบรับสินค้า',
                error: error.message
            });
        }
    } finally {
        connection.release();
    }
});

// PUT update receipt1 with details
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
            TYPE_VAT,
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

        // ดึงรายการเดิมเพื่อคืนค่าใน BAL_DRUG ก่อน
        const [oldDetails] = await connection.execute(
            'SELECT DRUG_CODE, LOT_NO, QTY, AMT FROM RECEIPT1_DT WHERE REFNO = ?',
            [refno]
        );

        // คืนค่าใน BAL_DRUG (ลบออก)
        for (const oldDetail of oldDetails) {
            const lotNo = oldDetail.LOT_NO || '-';
            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [oldDetail.DRUG_CODE, lotNo]
            );

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty - (parseFloat(oldDetail.QTY) || 0); // ลบออก
                const newAmt = oldAmt - (parseFloat(oldDetail.AMT) || 0);

                await connection.execute(
                    'UPDATE BAL_DRUG SET QTY = ?, AMT = ? WHERE DRUG_CODE = ? AND LOT_NO = ?',
                    [newQty, newAmt, oldDetail.DRUG_CODE, lotNo]
                );
            }
        }

        await connection.execute('DELETE FROM STOCK_CARD WHERE REFNO = ?', [refno]);

        const detailTotal = details.reduce((sum, item) => sum + (parseFloat(item.AMT) || 0), 0);
        const vatRate = parseFloat(VAT1) || 0;
        const typeVat = TYPE_VAT || 'include';

        let total, vamt, gtotal;

        // ✅ ถ้า VAT1 เป็น 0% ให้ไม่คำนวณ VAT
        if (vatRate === 0) {
            total = detailTotal;
            vamt = 0;
            gtotal = detailTotal;
        } else {
            if (typeVat === 'include') {
                gtotal = detailTotal;
                vamt = (detailTotal * vatRate) / (100 + vatRate);
                total = detailTotal - vamt;
            } else {
                total = detailTotal;
                vamt = total * (vatRate / 100);
                gtotal = total + vamt;
            }
        }

        const [result] = await connection.execute(`
            UPDATE RECEIPT1 SET 
                RDATE = ?,
                TRDATE = ?,
                MYEAR = ?,
                MONTHH = ?,
                SUPPLIER_CODE = ?,
                DUEDATE = ?,
                STATUS = ?,
                TOTAL = ?,
                VAT1 = ?,
                TYPE_VAT = ?,
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
            typeVat,
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
                message: 'ไม่พบใบรับสินค้าที่ต้องการแก้ไข'
            });
        }

        await connection.execute('DELETE FROM RECEIPT1_DT WHERE REFNO = ?', [refno]);

        for (const detail of details) {
            await connection.execute(`
                INSERT INTO RECEIPT1_DT (
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
                detail.QTY,
                0,
                0,
                detail.UNIT_COST,
                detail.AMT,
                0,
                0,
                detail.LOT_NO,
                detail.EXPIRE_DATE
            ]);

            // ** ✅ UPDATE BAL_DRUG **
            const lotNo = detail.LOT_NO || '-';
            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [detail.DRUG_CODE, lotNo]
            );

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty + (parseFloat(detail.QTY) || 0);
                const newAmt = oldAmt + (parseFloat(detail.AMT) || 0);

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
                    parseFloat(detail.QTY) || 0,
                    detail.UNIT_COST,
                    parseFloat(detail.AMT) || 0
                ]);
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'แก้ไขใบรับสินค้าสำเร็จ และอัปเดตข้อมูลใน STOCK_CARD และ BAL_DRUG แล้ว',
            data: {
                REFNO: refno,
                TOTAL: total,
                GTOTAL: gtotal,
                detailCount: details.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating receipt1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไข',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// DELETE receipt1
router.delete('/:refno', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { refno } = req.params;

        // ดึงรายการเพื่อคืนค่าใน BAL_DRUG
        const [details] = await connection.execute(
            'SELECT DRUG_CODE, LOT_NO, QTY, AMT FROM RECEIPT1_DT WHERE REFNO = ?',
            [refno]
        );

        // คืนค่าใน BAL_DRUG (ลบออก)
        for (const detail of details) {
            const lotNo = detail.LOT_NO || '-';
            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND LOT_NO = ? LIMIT 1',
                [detail.DRUG_CODE, lotNo]
            );

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty - (parseFloat(detail.QTY) || 0); // ลบออก
                const newAmt = oldAmt - (parseFloat(detail.AMT) || 0);

                await connection.execute(
                    'UPDATE BAL_DRUG SET QTY = ?, AMT = ? WHERE DRUG_CODE = ? AND LOT_NO = ?',
                    [newQty, newAmt, detail.DRUG_CODE, lotNo]
                );
            }
        }

        await connection.execute('DELETE FROM STOCK_CARD WHERE REFNO = ?', [refno]);
        await connection.execute('DELETE FROM RECEIPT1_DT WHERE REFNO = ?', [refno]);

        const [result] = await connection.execute('DELETE FROM RECEIPT1 WHERE REFNO = ?', [refno]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบใบรับสินค้าที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบใบรับสินค้าสำเร็จ และอัปเดตข้อมูลใน STOCK_CARD และ BAL_DRUG แล้ว'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting receipt1:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบ',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// GET receipt1 by month/year
router.get('/period/:year/:month', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { year, month } = req.params;

        const [rows] = await db.execute(`
            SELECT 
                r.*,
                tp.type_pay_name
            FROM RECEIPT1 r
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
        console.error('Error fetching receipt1 by period:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        });
    }
});

// Check if REFNO exists
router.get('/check/:refno', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { refno } = req.params;

        const [rows] = await db.execute(`
            SELECT REFNO FROM RECEIPT1 WHERE REFNO = ?
        `, [refno]);

        res.json({
            success: true,
            exists: rows.length > 0,
            refno: refno
        });
    } catch (error) {
        console.error('Error checking REFNO:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบเลขที่',
            error: error.message
        });
    }
});

module.exports = router;