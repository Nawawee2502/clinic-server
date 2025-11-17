const express = require('express');
const router = express.Router();
const dbPoolPromise = require('../config/db');

// GET all BAL_CASH records
router.get('/', async (req, res) => {
    try {
        const db = await dbPoolPromise;
        const { date_from, date_to, year, month } = req.query;

        let query = 'SELECT * FROM BAL_CASH WHERE 1=1';
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

        query += ' ORDER BY RDATE DESC';

        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching BAL_CASH:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดยกมาเงินสด',
            error: error.message
        });
    }
});

// GET BAL_CASH by date
router.get('/date/:date', async (req, res) => {
    try {
        const db = await dbPoolPromise;
        const { date } = req.params;

        const [rows] = await db.execute(
            'SELECT * FROM BAL_CASH WHERE RDATE = ?',
            [date]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาเงินสดสำหรับวันที่นี้'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching BAL_CASH by date:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดยกมาเงินสด',
            error: error.message
        });
    }
});

// POST create or update BAL_CASH and propagate to future dates
router.post('/', async (req, res) => {
    let connection;
    try {
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { RDATE, AMT } = req.body;

        if (!RDATE || AMT === undefined || AMT === null) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุวันที่และจำนวนเงิน'
            });
        }

        const date = new Date(RDATE);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        // Check if record exists for this date
        const [existing] = await connection.execute(
            'SELECT * FROM BAL_CASH WHERE RDATE = ?',
            [RDATE]
        );

        if (existing.length > 0) {
            // Update existing record
            await connection.execute(
                'UPDATE BAL_CASH SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ?',
                [AMT, year, month, RDATE]
            );
        } else {
            // Insert new record
            await connection.execute(
                'INSERT INTO BAL_CASH (RDATE, AMT, MYEAR, MONTHH) VALUES (?, ?, ?, ?)',
                [RDATE, AMT, year, month]
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

            // Check if record exists for this date
            const [existingNext] = await connection.execute(
                'SELECT * FROM BAL_CASH WHERE RDATE = ?',
                [nextDateStr]
            );

            if (existingNext.length > 0) {
                // Update existing record with current balance
                await connection.execute(
                    'UPDATE BAL_CASH SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ?',
                    [currentBalance, nextYear, nextMonth, nextDateStr]
                );
            } else {
                // Insert new record with current balance
                await connection.execute(
                    'INSERT INTO BAL_CASH (RDATE, AMT, MYEAR, MONTHH) VALUES (?, ?, ?, ?)',
                    [nextDateStr, currentBalance, nextYear, nextMonth]
                );
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'บันทึกยอดยกมาเงินสดและยอดยกไปสำเร็จ',
            data: {
                RDATE,
                AMT,
                propagated: true
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error creating/updating BAL_CASH:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการบันทึกยอดยกมาเงินสด',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// PUT update BAL_CASH for specific date
router.put('/:date', async (req, res) => {
    let connection;
    try {
        const pool = await dbPoolPromise;
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { date } = req.params;
        const { AMT } = req.body;

        if (AMT === undefined || AMT === null) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุจำนวนเงิน'
            });
        }

        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;

        const [existing] = await connection.execute(
            'SELECT * FROM BAL_CASH WHERE RDATE = ?',
            [date]
        );

        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาเงินสดสำหรับวันที่นี้'
            });
        }

        await connection.execute(
            'UPDATE BAL_CASH SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ?',
            [AMT, year, month, date]
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
                'SELECT * FROM BAL_CASH WHERE RDATE = ?',
                [nextDateStr]
            );

            if (existingNext.length > 0) {
                await connection.execute(
                    'UPDATE BAL_CASH SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ?',
                    [currentBalance, nextYear, nextMonth, nextDateStr]
                );
            } else {
                await connection.execute(
                    'INSERT INTO BAL_CASH (RDATE, AMT, MYEAR, MONTHH) VALUES (?, ?, ?, ?)',
                    [nextDateStr, currentBalance, nextYear, nextMonth]
                );
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'อัปเดตยอดยกมาเงินสดสำเร็จ',
            data: {
                RDATE: date,
                AMT
            }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error updating BAL_CASH:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตยอดยกมาเงินสด',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// DELETE BAL_CASH for specific date
router.delete('/:date', async (req, res) => {
    try {
        const db = await dbPoolPromise;
        const { date } = req.params;

        const [result] = await db.execute(
            'DELETE FROM BAL_CASH WHERE RDATE = ?',
            [date]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลยอดยกมาเงินสดสำหรับวันที่นี้'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลยอดยกมาเงินสดสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting BAL_CASH:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบข้อมูลยอดยกมาเงินสด',
            error: error.message
        });
    }
});

module.exports = router;

