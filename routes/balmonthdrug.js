const express = require('express');
const router = express.Router();

const getFirstDayOfMonth = (year, month) => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    if (Number.isNaN(y) || Number.isNaN(m)) {
        return new Date().toISOString().slice(0, 10);
    }

    return new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
};

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
                b.AMT,
                b.LOT_NO,
                b.EXPIRE_DATE
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
                b.AMT,
                b.LOT_NO,
                b.EXPIRE_DATE
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
                b.AMT,
                b.LOT_NO,
                b.EXPIRE_DATE
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
                b.AMT,
                b.LOT_NO,
                b.EXPIRE_DATE
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
                b.AMT,
                b.LOT_NO,
                b.EXPIRE_DATE
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
            EXPIRE_DATE
        } = req.body;

        console.log('📝 Received data:', req.body);

        const periodDate = getFirstDayOfMonth(MYEAR, MONTHH);

        if (!MYEAR || !MONTHH || !DRUG_CODE) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุปี เดือน และรหัสยา'
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

        // ✅ เช็คว่ามีข้อมูลอยู่แล้วหรือไม่ - ถ้ามี LOT_NO เดียวกันให้ UPDATE แทน INSERT
        // ✅ ถ้า LOT_NO ต่างกัน ให้ INSERT ใหม่ (ไม่ต้องเช็คซ้ำ)
        const lotNoValue = LOT_NO || null;
        const [existing] = await connection.execute(
            `SELECT * FROM BEG_MONTH_DRUG 
             WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? 
             AND ((LOT_NO = ?) OR (LOT_NO IS NULL AND ? IS NULL))`,
            [MYEAR, MONTHH, DRUG_CODE, lotNoValue, lotNoValue]
        );

        let isUpdate = existing.length > 0;
        let balDrugUpdated = false; // ✅ flag ว่า BAL_DRUG ถูกอัปเดตแล้วหรือยัง

        if (isUpdate) {
            // ✅ ถ้ามีข้อมูลอยู่แล้ว ให้ UPDATE แทน
            console.log('📝 Updating existing record in BEG_MONTH_DRUG...');

            // ดึงข้อมูลเดิมเพื่อคำนวณ BAL_DRUG
            const oldQty = parseFloat(existing[0].QTY) || 0;
            const oldAmt = parseFloat(existing[0].AMT) || 0;

            await connection.execute(
                `UPDATE BEG_MONTH_DRUG SET 
                    UNIT_CODE1 = ?, 
                    QTY = ?, 
                    UNIT_PRICE = ?,
                    AMT = ?,
                    LOT_NO = ?,
                    EXPIRE_DATE = ?
                WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? 
                AND ((LOT_NO = ?) OR (LOT_NO IS NULL AND ? IS NULL))`,
                [
                    UNIT_CODE1 || null,
                    QTY || 0,
                    UNIT_PRICE || 0,
                    AMT || 0,
                    LOT_NO || null,
                    EXPIRE_DATE || null,
                    MYEAR,
                    MONTHH,
                    DRUG_CODE,
                    lotNoValue,
                    lotNoValue
                ]
            );
            console.log('✅ Updated BEG_MONTH_DRUG');

            // ✅ อัปเดต STOCK_CARD เมื่อ UPDATE (เช็ค LOTNO ด้วย)
            const lotNoForStock = LOT_NO || '-';
            const [stockCheck] = await connection.execute(
                `SELECT * FROM STOCK_CARD 
                 WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? 
                 AND ((LOTNO = ?) OR (LOTNO IS NULL AND ? = '-'))`,
                [MYEAR, MONTHH, DRUG_CODE, lotNoForStock, lotNoForStock]
            );

            if (stockCheck.length > 0) {
                // ✅ ถ้ามี LOTNO เดียวกัน ให้ UPDATE
                await connection.execute(
                    `UPDATE STOCK_CARD SET 
                        REFNO = 'BEG',
                        RDATE = ?,
                        TRDATE = ?,
                        UNIT_CODE1 = ?, 
                        BEG1 = ?,
                        BEG1_AMT = ?,
                        UNIT_COST = ?,
                        LOTNO = ?,
                        EXPIRE_DATE = ?
                    WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? 
                    AND ((LOTNO = ?) OR (LOTNO IS NULL AND ? = '-'))`,
                    [periodDate, periodDate, UNIT_CODE1 || null, QTY || 0, AMT || 0, UNIT_PRICE || 0, lotNoForStock, EXPIRE_DATE || '-', MYEAR, MONTHH, DRUG_CODE, lotNoForStock, lotNoForStock]
                );
                console.log('✅ Updated STOCK_CARD with REFNO = BEG, BEG1, BEG1_AMT, UNIT_COST, LOTNO (same LOT)');
            } else {
                // ✅ ถ้า LOTNO ต่างกัน ให้ INSERT ใหม่
                await connection.execute(
                    `INSERT INTO STOCK_CARD (
                        REFNO, RDATE, TRDATE,
                        MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1, 
                        BEG1, IN1, OUT1, UPD1,
                        UNIT_COST, BEG1_AMT, IN1_AMT, OUT1_AMT, UPD1_AMT,
                        LOTNO, EXPIRE_DATE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'BEG',
                        periodDate,
                        periodDate,
                        MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1 || null,
                        QTY || 0, 0, 0, 0,
                        UNIT_PRICE || 0, AMT || 0, 0, 0, 0,
                        lotNoForStock, EXPIRE_DATE || '-'
                    ]
                );
                console.log('✅ Inserted into STOCK_CARD with REFNO = BEG, BEG1, BEG1_AMT, UNIT_COST, LOTNO (new LOT)');

                // ✅ ถ้า INSERT STOCK_CARD ใหม่ (LOTNO ต่างกัน) ให้บวกค่าเข้า BAL_DRUG ด้วย
                const [existingBalForNewLot] = await connection.execute(
                    'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? ORDER BY AMT DESC LIMIT 1',
                    [DRUG_CODE]
                );

                if (existingBalForNewLot.length > 0) {
                    const balOldQty = parseFloat(existingBalForNewLot[0].QTY) || 0;
                    const balOldAmt = parseFloat(existingBalForNewLot[0].AMT) || 0;
                    // บวกค่าใหม่เข้าไป (ไม่ต้องลบค่าเดิมเพราะเป็น LOT ใหม่)
                    const newQty = balOldQty + (parseFloat(QTY) || 0);
                    const newAmt = balOldAmt + (parseFloat(AMT) || 0);

                    await connection.execute(
                        `UPDATE BAL_DRUG SET 
                            QTY = ?, 
                            AMT = ?,
                            UNIT_PRICE = ?,
                            UNIT_CODE1 = ?,
                            LOT_NO = ?,
                            EXPIRE_DATE = ?,
                            TEXPIRE_DATE = ?
                        WHERE DRUG_CODE = ?
                        ORDER BY AMT DESC
                        LIMIT 1`,
                        [
                            newQty,
                            newAmt,
                            UNIT_PRICE || 0,
                            UNIT_CODE1 || null,
                            '-',
                            '-',
                            '-',
                            DRUG_CODE
                        ]
                    );
                    console.log('✅ Updated BAL_DRUG (added new LOT values)');
                } else {
                    // ไม่มีข้อมูล → INSERT ใหม่
                    await connection.execute(
                        `INSERT INTO BAL_DRUG (
                            DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE,
                            UNIT_CODE1, QTY, UNIT_PRICE, AMT
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            DRUG_CODE, '-', '-', '-',
                            UNIT_CODE1 || null,
                            parseFloat(QTY) || 0,
                            UNIT_PRICE || 0,
                            parseFloat(AMT) || 0
                        ]
                    );
                    console.log('✅ Inserted new record into BAL_DRUG (new LOT)');
                }
                balDrugUpdated = true; // ✅ ตั้ง flag ว่า BAL_DRUG ถูกอัปเดตแล้ว
            }

            // ✅ คำนวณ BAL_DRUG โดยลบค่าเดิมก่อน แล้วบวกค่าใหม่ (กรณี UPDATE STOCK_CARD เดิม)
            if (!balDrugUpdated) {
                const [existingBal] = await connection.execute(
                    'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? ORDER BY AMT DESC LIMIT 1',
                    [DRUG_CODE]
                );

                if (existingBal.length > 0) {
                    const balOldQty = parseFloat(existingBal[0].QTY) || 0;
                    const balOldAmt = parseFloat(existingBal[0].AMT) || 0;
                    // ลบค่าเดิมออกก่อน แล้วบวกค่าใหม่
                    const newQty = balOldQty - oldQty + (parseFloat(QTY) || 0);
                    const newAmt = balOldAmt - oldAmt + (parseFloat(AMT) || 0);

                    await connection.execute(
                        `UPDATE BAL_DRUG SET 
                            QTY = ?, 
                            AMT = ?,
                            UNIT_PRICE = ?,
                            UNIT_CODE1 = ?,
                            LOT_NO = ?,
                            EXPIRE_DATE = ?,
                            TEXPIRE_DATE = ?
                        WHERE DRUG_CODE = ?
                        ORDER BY AMT DESC
                        LIMIT 1`,
                        [
                            newQty,
                            newAmt,
                            UNIT_PRICE || 0,
                            UNIT_CODE1 || null,
                            '-',
                            '-',
                            '-',
                            DRUG_CODE
                        ]
                    );
                    console.log('✅ Updated BAL_DRUG (replaced old values)');
                }
            }
        } else {
            // ✅ ถ้าไม่มีข้อมูล ให้ INSERT ใหม่
            console.log('📝 Inserting into BEG_MONTH_DRUG...');
            await connection.execute(
                `INSERT INTO BEG_MONTH_DRUG (
                    MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1, 
                    QTY, UNIT_PRICE, AMT, LOT_NO, EXPIRE_DATE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    MYEAR,
                    MONTHH,
                    DRUG_CODE,
                    UNIT_CODE1 || null,
                    QTY || 0,
                    UNIT_PRICE || 0,
                    AMT || 0,
                    LOT_NO || null,
                    EXPIRE_DATE || null
                ]
            );
            console.log('✅ Inserted into BEG_MONTH_DRUG');

            // 2. เพิ่มหรืออัปเดต STOCK_CARD (กรณี INSERT ใหม่) - เช็ค LOTNO ด้วย
            console.log('📝 Managing STOCK_CARD...');
            const lotNoForStock = LOT_NO || '-';
            const [stockCheck] = await connection.execute(
                `SELECT * FROM STOCK_CARD 
                 WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? 
                 AND ((LOTNO = ?) OR (LOTNO IS NULL AND ? = '-'))`,
                [MYEAR, MONTHH, DRUG_CODE, lotNoForStock, lotNoForStock]
            );

            if (stockCheck.length > 0) {
                // ✅ ถ้ามี LOTNO เดียวกัน ให้ UPDATE
                await connection.execute(
                    `UPDATE STOCK_CARD SET 
                        REFNO = 'BEG',
                        RDATE = ?,
                        TRDATE = ?,
                        UNIT_CODE1 = ?, 
                        BEG1 = ?,
                        BEG1_AMT = ?,
                        UNIT_COST = ?,
                        LOTNO = ?,
                        EXPIRE_DATE = ?
                    WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ? 
                    AND ((LOTNO = ?) OR (LOTNO IS NULL AND ? = '-'))`,
                    [periodDate, periodDate, UNIT_CODE1 || null, QTY || 0, AMT || 0, UNIT_PRICE || 0, lotNoForStock, EXPIRE_DATE || '-', MYEAR, MONTHH, DRUG_CODE, lotNoForStock, lotNoForStock]
                );
                console.log('✅ Updated STOCK_CARD with REFNO = BEG, BEG1, BEG1_AMT, UNIT_COST, LOTNO (same LOT)');
            } else {
                // ✅ ถ้า LOTNO ต่างกัน ให้ INSERT ใหม่
                await connection.execute(
                    `INSERT INTO STOCK_CARD (
                        REFNO, RDATE, TRDATE,
                        MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1, 
                        BEG1, IN1, OUT1, UPD1,
                        UNIT_COST, BEG1_AMT, IN1_AMT, OUT1_AMT, UPD1_AMT,
                        LOTNO, EXPIRE_DATE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        'BEG',
                        periodDate,
                        periodDate,
                        MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1 || null,
                        QTY || 0, 0, 0, 0,
                        UNIT_PRICE || 0, AMT || 0, 0, 0, 0,
                        lotNoForStock, EXPIRE_DATE || '-'
                    ]
                );
                console.log('✅ Inserted into STOCK_CARD with REFNO = BEG, BEG1, BEG1_AMT, UNIT_COST, LOTNO (new LOT)');
            }

            // ✅ อัปเดต BAL_DRUG สำหรับกรณี INSERT BEG_MONTH_DRUG ใหม่ (เช็คตาม LOT_NO)
            console.log('📝 Managing BAL_DRUG for new BEG_MONTH_DRUG...');
            const lotNoForBal = LOT_NO || '-';
            const [existingBalForNew] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? AND (LOT_NO = ? OR (? = \'-\' AND LOT_NO IS NULL)) LIMIT 1',
                [DRUG_CODE, lotNoForBal, lotNoForBal]
            );

            if (existingBalForNew.length > 0) {
                // ✅ มีข้อมูลอยู่แล้ว (LOT_NO เดียวกัน) → UPDATE
                const oldQty = parseFloat(existingBalForNew[0].QTY) || 0;
                const oldAmt = parseFloat(existingBalForNew[0].AMT) || 0;
                const newQty = oldQty + (parseFloat(QTY) || 0);
                const newAmt = oldAmt + (parseFloat(AMT) || 0);

                console.log(`📊 Calculated: Old QTY=${oldQty}, Old AMT=${oldAmt} → New QTY=${newQty}, New AMT=${newAmt}`);

                await connection.execute(
                    `UPDATE BAL_DRUG SET 
                        QTY = ?, 
                        AMT = ?,
                        UNIT_PRICE = ?,
                        UNIT_CODE1 = ?,
                        LOT_NO = ?,
                        EXPIRE_DATE = ?,
                        TEXPIRE_DATE = ?
                    WHERE DRUG_CODE = ? AND (LOT_NO = ? OR (? = '-' AND LOT_NO IS NULL))`,
                    [
                        newQty,
                        newAmt,
                        UNIT_PRICE || 0,
                        UNIT_CODE1 || null,
                        lotNoForBal,
                        EXPIRE_DATE || '-',
                        EXPIRE_DATE || '-',
                        DRUG_CODE,
                        lotNoForBal,
                        lotNoForBal
                    ]
                );
                console.log('✅ Updated BAL_DRUG (added new BEG_MONTH_DRUG values, same LOT)');
            } else {
                // ✅ ไม่มีข้อมูล (LOT_NO ต่างกัน) → INSERT ใหม่
                await connection.execute(
                    `INSERT INTO BAL_DRUG (
                        DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE,
                        UNIT_CODE1, QTY, UNIT_PRICE, AMT
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        DRUG_CODE,
                        lotNoForBal,
                        EXPIRE_DATE || '-',
                        EXPIRE_DATE || '-',
                        UNIT_CODE1 || null,
                        parseFloat(QTY) || 0,
                        UNIT_PRICE || 0,
                        parseFloat(AMT) || 0
                    ]
                );
                console.log('✅ Inserted new record into BAL_DRUG (new BEG_MONTH_DRUG, new LOT)');
            }
        }

        await connection.commit();
        console.log('✅ Transaction committed successfully');

        res.status(201).json({
            success: true,
            message: isUpdate
                ? 'อัปเดตข้อมูลยอดยกมาสำเร็จในทั้ง 3 ตาราง'
                : 'เพิ่มข้อมูลยอดยกมาสำเร็จในทั้ง 3 ตาราง (BAL_DRUG อัปเดตแล้ว)',
            data: {
                MYEAR,
                MONTHH,
                DRUG_CODE,
                UNIT_CODE1,
                QTY,
                UNIT_PRICE,
                AMT,
                isUpdate
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error creating balance:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.sqlMessage || error.message);

        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลยอดยกมา',
            error: error.message,
            code: error.code,
            sqlMessage: error.sqlMessage
        });
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
        const { UNIT_CODE1, QTY, UNIT_PRICE, AMT, LOT_NO, EXPIRE_DATE } = req.body;

        console.log('📝 Updating:', { year, month, drugCode, UNIT_CODE1, QTY, UNIT_PRICE, AMT });

        const periodDate = getFirstDayOfMonth(year, month);

        // ดึงข้อมูลเดิมเพื่อคืนค่าใน BAL_DRUG ก่อน
        const [oldData] = await connection.execute(
            'SELECT QTY, AMT FROM BEG_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?',
            [year, month, drugCode]
        );

        if (oldData.length > 0) {
            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? ORDER BY AMT DESC LIMIT 1',
                [drugCode]
            );

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                // ลบค่าเดิมออกก่อน
                const newQty = oldQty - (parseFloat(oldData[0].QTY) || 0);
                const newAmt = oldAmt - (parseFloat(oldData[0].AMT) || 0);

                await connection.execute(
                    'UPDATE BAL_DRUG SET QTY = ?, AMT = ? WHERE DRUG_CODE = ? ORDER BY AMT DESC LIMIT 1',
                    [newQty, newAmt, drugCode]
                );
            }
        }

        // 1. อัปเดต BEG_MONTH_DRUG
        const [result] = await connection.execute(
            `UPDATE BEG_MONTH_DRUG SET 
                UNIT_CODE1 = ?, 
                QTY = ?, 
                UNIT_PRICE = ?,
                AMT = ?,
                LOT_NO = ?,
                EXPIRE_DATE = ?
            WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?`,
            [UNIT_CODE1 || null, QTY || 0, UNIT_PRICE || 0, AMT || 0, LOT_NO || null, EXPIRE_DATE || null, year, month, drugCode]
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
                REFNO = 'BEG',
                RDATE = ?,
                TRDATE = ?,
                UNIT_CODE1 = ?, 
                BEG1 = ?,
                BEG1_AMT = ?,
                UNIT_COST = ?
            WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?`,
            [periodDate, periodDate, UNIT_CODE1 || null, QTY || 0, AMT || 0, UNIT_PRICE || 0, year, month, drugCode]
        );
        console.log('✅ Updated STOCK_CARD with REFNO = BEG and BEG1_AMT');

        // 3. ** ✅ UPDATE BAL_DRUG **
        const [existingBal] = await connection.execute(
            'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? ORDER BY AMT DESC LIMIT 1',
            [drugCode]
        );

        if (existingBal.length > 0) {
            const oldQty = parseFloat(existingBal[0].QTY) || 0;
            const oldAmt = parseFloat(existingBal[0].AMT) || 0;
            const newQty = oldQty + (parseFloat(QTY) || 0);
            const newAmt = oldAmt + (parseFloat(AMT) || 0);

            await connection.execute(
                `UPDATE BAL_DRUG SET 
                    QTY = ?, 
                    AMT = ?,
                    UNIT_PRICE = ?,
                    UNIT_CODE1 = ?
                WHERE DRUG_CODE = ?
                ORDER BY AMT DESC
                LIMIT 1`,
                [
                    newQty,
                    newAmt,
                    UNIT_PRICE || 0,
                    UNIT_CODE1 || null,
                    drugCode
                ]
            );
        } else {
            await connection.execute(
                `INSERT INTO BAL_DRUG (
                    DRUG_CODE, LOT_NO, EXPIRE_DATE, TEXPIRE_DATE, 
                    UNIT_CODE1, QTY, UNIT_PRICE, AMT
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [drugCode, '-', '-', '-', UNIT_CODE1 || null, QTY || 0, UNIT_PRICE || 0, AMT || 0]
            );
        }

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

// DELETE balance record
router.delete('/:year/:month/:drugCode', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month, drugCode } = req.params;
        const { lotNo, isLotNoNull } = req.query;

        const trimmedLotNo = typeof lotNo === 'string' ? lotNo.trim() : null;
        const isLotNull = isLotNoNull === 'true';

        if (!isLotNull && (!trimmedLotNo || trimmedLotNo.length === 0)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ LOT_NO สำหรับการลบข้อมูล'
            });
        }

        console.log('🗑️ Deleting:', { year, month, drugCode, lotNo: trimmedLotNo, isLotNull });

        const baseClause = 'MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?';
        const baseParams = [year, month, drugCode];
        const lotCondition = isLotNull
            ? ' AND (LOT_NO IS NULL OR LOT_NO = \'\')'
            : ' AND LOT_NO = ?';

        const selectParams = isLotNull
            ? [...baseParams]
            : [...baseParams, trimmedLotNo];

        const [oldData] = await connection.execute(
            `SELECT QTY, AMT, LOT_NO FROM BEG_MONTH_DRUG WHERE ${baseClause}${lotCondition}`,
            selectParams
        );

        if (oldData.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาที่ต้องการลบ'
            });
        }

        const record = oldData[0];
        const qtyToRemove = parseFloat(record.QTY) || 0;
        const amtToRemove = parseFloat(record.AMT) || 0;
        const recordLotNo = record.LOT_NO && record.LOT_NO.trim() !== '' ? record.LOT_NO.trim() : null;

        const lotNoForBal = recordLotNo || '-';
        let balSelectQuery = 'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ?';
        const balSelectParams = [drugCode];

        if (lotNoForBal === '-') {
            balSelectQuery += " AND (LOT_NO IS NULL OR LOT_NO = '-')";
        } else {
            balSelectQuery += ' AND LOT_NO = ?';
            balSelectParams.push(lotNoForBal);
        }

        balSelectQuery += ' ORDER BY AMT DESC LIMIT 1';

        const [existingBal] = await connection.execute(balSelectQuery, balSelectParams);

        if (existingBal.length > 0) {
            const oldQty = parseFloat(existingBal[0].QTY) || 0;
            const oldAmt = parseFloat(existingBal[0].AMT) || 0;
            const newQty = oldQty - qtyToRemove;
            const newAmt = oldAmt - amtToRemove;

            let balUpdateQuery = 'UPDATE BAL_DRUG SET QTY = ?, AMT = ? WHERE DRUG_CODE = ?';
            const balUpdateParams = [newQty, newAmt, drugCode];

            if (lotNoForBal === '-') {
                balUpdateQuery += " AND (LOT_NO IS NULL OR LOT_NO = '-')";
            } else {
                balUpdateQuery += ' AND LOT_NO = ?';
                balUpdateParams.push(lotNoForBal);
            }

            balUpdateQuery += ' ORDER BY AMT DESC LIMIT 1';

            await connection.execute(balUpdateQuery, balUpdateParams);
        }

        const deleteParams = [...selectParams];
        const [deleteResult] = await connection.execute(
            `DELETE FROM BEG_MONTH_DRUG WHERE ${baseClause}${lotCondition}`,
            deleteParams
        );

        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาที่ต้องการลบ'
            });
        }

        const lotNoForStock = recordLotNo || '-';
        let deleteStockQuery = 'DELETE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ? AND DRUG_CODE = ?';
        const deleteStockParams = [year, month, drugCode];

        if (lotNoForStock === '-') {
            deleteStockQuery += " AND (LOTNO IS NULL OR LOTNO = '-' OR LOTNO = '')";
        } else {
            deleteStockQuery += ' AND LOTNO = ?';
            deleteStockParams.push(lotNoForStock);
        }

        await connection.execute(deleteStockQuery, deleteStockParams);

        await connection.commit();

        console.log('✅ Balance record deleted successfully from 3 tables', { lotNo: recordLotNo });

        res.json({
            success: true,
            message: 'ลบข้อมูลยอดยกมาสำเร็จจากทั้ง 3 ตาราง',
            lotNo: recordLotNo
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

// DELETE all records for a specific period
router.delete('/period/:year/:month', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month } = req.params;

        console.log('🗑️ Deleting period:', { year, month });

        // ดึงรายการก่อนลบเพื่อคืนค่าใน BAL_DRUG
        const [drugs] = await connection.execute(
            'SELECT DRUG_CODE, QTY, AMT FROM BEG_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ?',
            [year, month]
        );

        for (const drug of drugs) {
            const [existingBal] = await connection.execute(
                'SELECT QTY, AMT FROM BAL_DRUG WHERE DRUG_CODE = ? ORDER BY AMT DESC LIMIT 1',
                [drug.DRUG_CODE]
            );

            if (existingBal.length > 0) {
                const oldQty = parseFloat(existingBal[0].QTY) || 0;
                const oldAmt = parseFloat(existingBal[0].AMT) || 0;
                const newQty = oldQty - (parseFloat(drug.QTY) || 0);
                const newAmt = oldAmt - (parseFloat(drug.AMT) || 0);

                await connection.execute(
                    'UPDATE BAL_DRUG SET QTY = ?, AMT = ? WHERE DRUG_CODE = ? ORDER BY AMT DESC LIMIT 1',
                    [newQty, newAmt, drug.DRUG_CODE]
                );
            }
        }

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

// ✅ POST Close Month (Snapshot BAL_DRUG to BEG_MONTH_DRUG & STOCK_CARD)
router.post('/close-month', async (req, res) => {
    const pool = require('../config/db');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { year, month } = req.body;
        console.log('🔒 Closing Month Request (Retroactive Supported):', { year, month });

        if (!year || !month) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุปีและเดือนที่จะปิดยอด'
            });
        }

        // ✅ Calculate Target Month (The month being opened)
        // Closing Dec 2023 -> Opens Beg Bal for Jan 2024
        let targetYear = parseInt(year);
        let targetMonth = parseInt(month) + 1;

        if (targetMonth > 12) {
            targetMonth = 1;
            targetYear += 1;
        }

        console.log(`📅 Month Transition: Closing ${month}/${year} -> Opening ${targetMonth}/${targetYear}`);

        // 🟢 1. Calculate Cut-off Date (The last moment of the month being closed)
        // We want the stock status at the END of the requested closing month.
        // Actually, for "Beginning of Target Month", it is effectively the moment before 1st of Target Month.
        const firstDayOfTargetMonth = getFirstDayOfMonth(targetYear, targetMonth);

        // 🟢 2. Fetch Current Balance (Snapshot at "Now")
        // We start with what we have NOW in BAL_DRUG
        const [currentStock] = await connection.execute(
            `SELECT DRUG_CODE, UNIT_CODE1, QTY, UNIT_PRICE, AMT, LOT_NO, EXPIRE_DATE 
             FROM BAL_DRUG 
             WHERE QTY > 0 AND QTY IS NOT NULL`
        );

        // Map to easily access by key (Drug + Lot)
        const stockMap = new Map();
        currentStock.forEach(item => {
            // Key: DrugCode | LotNo (Handle nulls)
            const key = `${item.DRUG_CODE}|${item.LOT_NO || '-'}`;
            stockMap.set(key, {
                qty: parseFloat(item.QTY) || 0,
                amt: parseFloat(item.AMT) || 0,
                unitPrice: parseFloat(item.UNIT_PRICE) || 0,
                unitCode: item.UNIT_CODE1,
                expireDate: item.EXPIRE_DATE
            });
        });

        // 🟢 3. Fetch "Future" Transactions (Movements AFTER the cut-off date)
        // We need to REVERSE these to go back in time.
        // Find movements in STOCK_CARD where TRDATE >= firstDayOfTargetMonth
        // Note: Using TRDATE (Transaction Date) is standard.
        const [futureMovements] = await connection.execute(
            `SELECT DRUG_CODE, LOTNO, 
                    SUM(IN1) as totalIn, 
                    SUM(OUT1) as totalOut, 
                    SUM(UPD1) as totalUpd,
                    SUM(IN1_AMT) as totalInAmt,
                    SUM(OUT1_AMT) as totalOutAmt,
                    SUM(UPD1_AMT) as totalUpdAmt
             FROM STOCK_CARD 
             WHERE TRDATE >= ? 
             AND REFNO != 'BEG' -- Exclude Opening Balances of future months to avoid double counting
             GROUP BY DRUG_CODE, LOTNO`,
            [firstDayOfTargetMonth]
        );

        // 🟢 4. Apply Reverse Calculation
        // Historical Stock = Current Stock - (In - Out + Upd)
        // Wait... Logic Check:
        // Start + In - Out = End (Current)
        // Start = End - In + Out
        // So: Historical = Current - In + Out - Upd (Assuming UPD is an adjustment that *added* to stock. If UPD can be negative, logic holds)
        // Let's refine:
        // BalanceNow = BalanceThen + InBetween - OutBetween + UpdBetween
        // BalanceThen = BalanceNow - InBetween + OutBetween - UpdBetween

        futureMovements.forEach(move => {
            const key = `${move.DRUG_CODE}|${move.LOTNO || '-'}`;
            const current = stockMap.get(key) || { qty: 0, amt: 0, unitPrice: 0, unitCode: null, expireDate: null };

            const totalIn = parseFloat(move.totalIn) || 0;
            const totalOut = parseFloat(move.totalOut) || 0;
            const totalUpd = parseFloat(move.totalUpd) || 0;

            const totalInAmt = parseFloat(move.totalInAmt) || 0;
            const totalOutAmt = parseFloat(move.totalOutAmt) || 0;
            const totalUpdAmt = parseFloat(move.totalUpdAmt) || 0;

            // Reverse calc
            const historicalQty = current.qty - totalIn + totalOut - totalUpd;
            const historicalAmt = current.amt - totalInAmt + totalOutAmt - totalUpdAmt;

            // Update or Set map
            stockMap.set(key, {
                ...current,
                qty: historicalQty,
                amt: historicalAmt,
                // Preserving metadata (might use current if available, otherwise it's lost for fully depleted items)
                // If item is fully depleted now but existed then, we might miss UnitCode/Price if not in BAL_DRUG.
                // Improvement: We could query metadata from TABLE_DRUG or history if needed.
                // For now, use current fallback or defaults.
            });
        });

        // 🟢 5. Prepare Data for Insertion
        const begEntries = [];
        for (const [key, data] of stockMap.entries()) {
            if (data.qty > 0.001) { // Filter out zero or near-zero floating point issues
                const [drugCode, lotNo] = key.split('|');
                const cleanLotNo = lotNo === '-' ? null : lotNo;

                begEntries.push([
                    targetYear, targetMonth, drugCode, data.unitCode,
                    data.qty, data.unitPrice, data.amt, cleanLotNo, data.expireDate
                ]);
            }
        }

        console.log(`📊 Calculated ${begEntries.length} items for Opening Balance of ${targetMonth}/${targetYear}`);

        // 🟢 6. Clear Existing Data (Allow Re-closing)
        await connection.execute(
            'DELETE FROM BEG_MONTH_DRUG WHERE MYEAR = ? AND MONTHH = ?',
            [targetYear, targetMonth]
        );

        await connection.execute(
            'DELETE FROM STOCK_CARD WHERE MYEAR = ? AND MONTHH = ? AND REFNO = \'BEG\'',
            [targetYear, targetMonth]
        );

        // 🟢 7. Batch Insert (Chunked for performance)
        if (begEntries.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < begEntries.length; i += chunkSize) {
                const chunk = begEntries.slice(i, i + chunkSize);

                // Construct Bulk Insert Query for BEG_MONTH_DRUG
                // Note: mysql2 execute doesn't support bulk insert with [[]] syntax natively for 'execute', use 'query' or manual placeholder building
                // We'll use manual placeholder building for transaction safety with 'execute'

                const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
                const flatValues = chunk.flat();

                await connection.execute(
                    `INSERT INTO BEG_MONTH_DRUG (
                        MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1, 
                        QTY, UNIT_PRICE, AMT, LOT_NO, EXPIRE_DATE
                    ) VALUES ${placeholders}`,
                    flatValues
                );

                // Construct Bulk Insert Query for STOCK_CARD
                const cardPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
                const cardValues = chunk.flatMap(item => [
                    'BEG', firstDayOfTargetMonth, firstDayOfTargetMonth,
                    item[0], item[1], item[2], item[3], // MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1
                    item[4], 0, 0, 0, // BEG1, IN1, OUT1, UPD1
                    item[5], item[6], 0, 0, 0, // UNIT_COST, BEG1_AMT...
                    item[7] || '-', item[8] // LOTNO, EXPIRE_DATE
                ]);

                await connection.execute(
                    `INSERT INTO STOCK_CARD (
                        REFNO, RDATE, TRDATE,
                        MYEAR, MONTHH, DRUG_CODE, UNIT_CODE1, 
                        BEG1, IN1, OUT1, UPD1,
                        UNIT_COST, BEG1_AMT, IN1_AMT, OUT1_AMT, UPD1_AMT,
                        LOTNO, EXPIRE_DATE
                    ) VALUES ${cardPlaceholders}`,
                    cardValues
                );
            }
        }

        await connection.commit();
        console.log('✅ Retroactive Monthly Closing Completed Successfully');

        res.json({
            success: true,
            message: `ปิดยอดประจำเดือน ${month}/${year} เรียบร้อยแล้ว (คำนวณย้อนหลัง)`,
            details: {
                closedPeriod: `${month}/${year}`,
                openedPeriod: `${targetMonth}/${targetYear}`,
                records: begEntries.length
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error closing month:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการปิดยอดประจำเดือน',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

module.exports = router;