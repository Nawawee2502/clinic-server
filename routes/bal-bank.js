const express = require('express');
const router = express.Router();
const dbPoolPromise = require('../config/db');

// GET all BAL_BANK records
router.get('/', async (req, res) => {
    try {
        const db = await dbPoolPromise;
        const { date_from, date_to, year, month, bank_no } = req.query;

        // Check if table exists, if not return empty array
        try {
            let query = 'SELECT * FROM BAL_BANK WHERE 1=1';
            const params = [];

            if (date_from) {
                query += ' AND RDATE >= ?';
                params.push(date_from);
            }
            if (date_to) {
                query += ' AND RDATE <= ?';
                params.push(date_to);
            }
            if (year) {
                query += ' AND MYEAR = ?';
                params.push(year);
            }
            if (month) {
                query += ' AND MONTHH = ?';
                params.push(month);
            }
            if (bank_no) {
                query += ' AND BANK_NO = ?';
                params.push(bank_no);
            }

            query += ' ORDER BY RDATE DESC, BANK_NO';

            const [rows] = await db.execute(query, params);

            res.json({
                success: true,
                data: rows,
                count: rows.length
            });
        } catch (tableError) {
            // If table doesn't exist, return empty array
            if (tableError.code === 'ER_NO_SUCH_TABLE' || tableError.message.includes("doesn't exist")) {
                console.log('BAL_BANK table does not exist yet, returning empty array');
                res.json({
                    success: true,
                    data: [],
                    count: 0
                });
            } else {
                throw tableError;
            }
        }
    } catch (error) {
        console.error('Error fetching BAL_BANK:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดยกมาเงินฝากธนาคาร',
            error: error.message
        });
    }
});

// GET BAL_BANK by date and bank_no
router.get('/date/:date/:bankNo', async (req, res) => {
    try {
        const db = await dbPoolPromise;
        const { date, bankNo } = req.params;

        try {
            const [rows] = await db.execute(
                'SELECT * FROM BAL_BANK WHERE RDATE = ? AND BANK_NO = ?',
                [date, bankNo]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลยอดยกมาเงินฝากธนาคารสำหรับวันที่และเลขบัญชีนี้'
                });
            }

            res.json({
                success: true,
                data: rows[0]
            });
        } catch (tableError) {
            if (tableError.code === 'ER_NO_SUCH_TABLE' || tableError.message.includes("doesn't exist")) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลยอดยกมาเงินฝากธนาคารสำหรับวันที่และเลขบัญชีนี้'
                });
            }
            throw tableError;
        }
    } catch (error) {
        console.error('Error fetching BAL_BANK by date and bank:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดยกมาเงินฝากธนาคาร',
            error: error.message
        });
    }
});

// POST create or update BAL_BANK and propagate to future dates
router.post('/', async (req, res) => {
    let connection;
    try {
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { RDATE, AMT, BANK_NO } = req.body;

        if (!RDATE || AMT === undefined || AMT === null || !BANK_NO) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุวันที่ จำนวนเงิน และเลขบัญชี'
            });
        }

        // Create table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS BAL_BANK (
                RDATE DATE NOT NULL,
                AMT DECIMAL(15,2) NOT NULL DEFAULT 0,
                BANK_NO VARCHAR(50) NOT NULL,
                MYEAR VARCHAR(4) NULL,
                MONTHH INT NULL,
                PRIMARY KEY (RDATE, BANK_NO)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);

        const date = new Date(RDATE);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        // Check if record exists for this date and bank_no
        const [existing] = await connection.execute(
            'SELECT * FROM BAL_BANK WHERE RDATE = ? AND BANK_NO = ?',
            [RDATE, BANK_NO]
        );

        if (existing.length > 0) {
            // Update existing record
            await connection.execute(
                'UPDATE BAL_BANK SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ? AND BANK_NO = ?',
                [AMT, year, month, RDATE, BANK_NO]
            );
        } else {
            // Insert new record
            await connection.execute(
                'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO, MYEAR, MONTHH) VALUES (?, ?, ?, ?, ?)',
                [RDATE, AMT, BANK_NO, year, month]
            );
        }

        // Propagate balance to all future dates until December 31 of current year
        // (December 1 will be the opening balance for November)
        const endDate = new Date(year, 11, 31); // December 31 of current year
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() + 1); // Start from next day

        let currentBalance = parseFloat(AMT);

        while (currentDate <= endDate) {
            const nextDateStr = currentDate.toISOString().split('T')[0];
            const nextYear = currentDate.getFullYear();
            const nextMonth = currentDate.getMonth() + 1;

            // Check if record exists for this date and bank_no
            const [existingNext] = await connection.execute(
                'SELECT * FROM BAL_BANK WHERE RDATE = ? AND BANK_NO = ?',
                [nextDateStr, BANK_NO]
            );

            if (existingNext.length > 0) {
                // Update existing record with current balance
                await connection.execute(
                    'UPDATE BAL_BANK SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ? AND BANK_NO = ?',
                    [currentBalance, nextYear, nextMonth, nextDateStr, BANK_NO]
                );
            } else {
                // Insert new record with current balance
                await connection.execute(
                    'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO, MYEAR, MONTHH) VALUES (?, ?, ?, ?, ?)',
                    [nextDateStr, currentBalance, BANK_NO, nextYear, nextMonth]
                );
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'บันทึกยอดยกมาเงินฝากธนาคารและยอดยกไปสำเร็จ',
            data: {
                RDATE,
                AMT,
                BANK_NO,
                propagated: true
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error creating/updating BAL_BANK:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการบันทึกยอดยกมาเงินฝากธนาคาร',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// PUT update BAL_BANK for specific date and bank_no
router.put('/:date/:bankNo', async (req, res) => {
    let connection;
    try {
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { date, bankNo } = req.params;
        const { AMT } = req.body;

        if (AMT === undefined || AMT === null) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุจำนวนเงิน'
            });
        }

        // Create table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS BAL_BANK (
                RDATE DATE NOT NULL,
                AMT DECIMAL(15,2) NOT NULL DEFAULT 0,
                BANK_NO VARCHAR(50) NOT NULL,
                MYEAR VARCHAR(4) NULL,
                MONTHH INT NULL,
                PRIMARY KEY (RDATE, BANK_NO)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);

        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;

        const [existing] = await connection.execute(
            'SELECT * FROM BAL_BANK WHERE RDATE = ? AND BANK_NO = ?',
            [date, bankNo]
        );

        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาเงินฝากธนาคารสำหรับวันที่และเลขบัญชีนี้'
            });
        }

        await connection.execute(
            'UPDATE BAL_BANK SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ? AND BANK_NO = ?',
            [AMT, year, month, date, bankNo]
        );

        // Recalculate future dates until December 31 of current year
        const endDate = new Date(year, 11, 31); // December 31 of current year
        const currentDate = new Date(dateObj);
        currentDate.setDate(currentDate.getDate() + 1);

        let currentBalance = parseFloat(AMT);

        while (currentDate <= endDate) {
            const nextDateStr = currentDate.toISOString().split('T')[0];
            const nextYear = currentDate.getFullYear();
            const nextMonth = currentDate.getMonth() + 1;

            const [existingNext] = await connection.execute(
                'SELECT * FROM BAL_BANK WHERE RDATE = ? AND BANK_NO = ?',
                [nextDateStr, bankNo]
            );

            if (existingNext.length > 0) {
                await connection.execute(
                    'UPDATE BAL_BANK SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ? AND BANK_NO = ?',
                    [currentBalance, nextYear, nextMonth, nextDateStr, bankNo]
                );
            } else {
                await connection.execute(
                    'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO, MYEAR, MONTHH) VALUES (?, ?, ?, ?, ?)',
                    [nextDateStr, currentBalance, bankNo, nextYear, nextMonth]
                );
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'อัปเดตยอดยกมาเงินฝากธนาคารสำเร็จ',
            data: {
                RDATE: date,
                AMT,
                BANK_NO: bankNo
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error updating BAL_BANK:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตยอดยกมาเงินฝากธนาคาร',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// DELETE BAL_BANK for specific date and bank_no
router.delete('/:date/:bankNo', async (req, res) => {
    try {
        const db = await dbPoolPromise;
        const { date, bankNo } = req.params;

        try {
            const [result] = await db.execute(
                'DELETE FROM BAL_BANK WHERE RDATE = ? AND BANK_NO = ?',
                [date, bankNo]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลยอดยกมาเงินฝากธนาคารสำหรับวันที่และเลขบัญชีนี้'
                });
            }

            res.json({
                success: true,
                message: 'ลบข้อมูลยอดยกมาเงินฝากธนาคารสำเร็จ'
            });
        } catch (tableError) {
            if (tableError.code === 'ER_NO_SUCH_TABLE' || tableError.message.includes("doesn't exist")) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลยอดยกมาเงินฝากธนาคารสำหรับวันที่และเลขบัญชีนี้'
                });
            }
            throw tableError;
        }
    } catch (error) {
        console.error('Error deleting BAL_BANK:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยอดยกมาเงินฝากธนาคาร',
            error: error.message
        });
    }
});

module.exports = router;

