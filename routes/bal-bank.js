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
            // Check if MYEAR and MONTHH columns exist
            const [columns] = await db.execute(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'BAL_BANK' 
                AND COLUMN_NAME IN ('MYEAR', 'MONTHH')
            `);
            const hasYearMonth = columns.length > 0;

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
            if (year && hasYearMonth) {
                query += ' AND MYEAR = ?';
                params.push(year);
            } else if (year) {
                // Filter by year using RDATE if MYEAR doesn't exist
                query += ' AND RDATE LIKE ?';
                params.push(`${year}%`);
            }
            if (month && hasYearMonth) {
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
            // Log the actual error for debugging
            console.error('BAL_BANK query error:', {
                code: tableError.code,
                errno: tableError.errno,
                sqlState: tableError.sqlState,
                sqlMessage: tableError.sqlMessage,
                message: tableError.message
            });

            // If table doesn't exist, return empty array
            // Check multiple possible error codes and messages
            const isTableNotExist = 
                tableError.code === 'ER_NO_SUCH_TABLE' ||
                tableError.code === '42S02' ||
                tableError.errno === 1146 ||
                (tableError.message && (
                    tableError.message.includes("doesn't exist") ||
                    tableError.message.includes("Unknown table") ||
                    tableError.message.includes("Table") && tableError.message.includes("doesn't exist")
                ));

            if (isTableNotExist) {
                console.log('BAL_BANK table does not exist yet, returning empty array');
                return res.json({
                    success: true,
                    data: [],
                    count: 0
                });
            } else {
                throw tableError;
            }
        }
    } catch (error) {
        console.error('Error fetching BAL_BANK:', {
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            message: error.message,
            stack: error.stack
        });
        
        // Return empty array instead of error to prevent 500
        // This allows the UI to work even if table doesn't exist
        res.json({
            success: true,
            data: [],
            count: 0,
            warning: 'ไม่สามารถโหลดข้อมูลได้ (ตารางอาจยังไม่ถูกสร้าง)'
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
            const isTableNotExist = 
                tableError.code === 'ER_NO_SUCH_TABLE' ||
                tableError.code === '42S02' ||
                tableError.errno === 1146 ||
                (tableError.message && (
                    tableError.message.includes("doesn't exist") ||
                    tableError.message.includes("Unknown table")
                ));

            if (isTableNotExist) {
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

        // Check if table exists, if not create it
        const [tableExists] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'BAL_BANK'
        `);

        if (tableExists[0].count === 0) {
            // Create table matching existing structure
            await connection.execute(`
                CREATE TABLE BAL_BANK (
                    RDATE VARCHAR(10) NOT NULL,
                    BANK_NO VARCHAR(50) NOT NULL,
                    AMT DOUBLE(12,2) NOT NULL DEFAULT 0,
                    PRIMARY KEY (RDATE, BANK_NO)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
            `);
        }

        // Check if MYEAR and MONTHH columns exist, if not add them
        const [yearMonthColumns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'BAL_BANK' 
            AND COLUMN_NAME IN ('MYEAR', 'MONTHH')
        `);

        const hasYear = yearMonthColumns.some(c => c.COLUMN_NAME === 'MYEAR');
        const hasMonth = yearMonthColumns.some(c => c.COLUMN_NAME === 'MONTHH');

        if (!hasYear) {
            await connection.execute(`ALTER TABLE BAL_BANK ADD COLUMN MYEAR VARCHAR(4) NULL`);
        }
        if (!hasMonth) {
            await connection.execute(`ALTER TABLE BAL_BANK ADD COLUMN MONTHH INT NULL`);
        }

        const date = new Date(RDATE);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        // Format RDATE as string (varchar) to match table structure
        const rdateStr = RDATE; // Keep as is (should be YYYY-MM-DD format)

        // Check if record exists for this date and bank_no
        const [existing] = await connection.execute(
            'SELECT * FROM BAL_BANK WHERE RDATE = ? AND BANK_NO = ?',
            [RDATE, BANK_NO]
        );

        if (existing.length > 0) {
            // Update existing record
            if (hasYear && hasMonth) {
                await connection.execute(
                    'UPDATE BAL_BANK SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ? AND BANK_NO = ?',
                    [AMT, year, month, rdateStr, BANK_NO]
                );
            } else {
                await connection.execute(
                    'UPDATE BAL_BANK SET AMT = ? WHERE RDATE = ? AND BANK_NO = ?',
                    [AMT, rdateStr, BANK_NO]
                );
            }
        } else {
            // Insert new record
            if (hasYear && hasMonth) {
                await connection.execute(
                    'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO, MYEAR, MONTHH) VALUES (?, ?, ?, ?, ?)',
                    [rdateStr, AMT, BANK_NO, year, month]
                );
            } else {
                await connection.execute(
                    'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO) VALUES (?, ?, ?)',
                    [rdateStr, AMT, BANK_NO]
                );
            }
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
                if (hasYear && hasMonth) {
                    await connection.execute(
                        'UPDATE BAL_BANK SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ? AND BANK_NO = ?',
                        [currentBalance, nextYear, nextMonth, nextDateStr, BANK_NO]
                    );
                } else {
                    await connection.execute(
                        'UPDATE BAL_BANK SET AMT = ? WHERE RDATE = ? AND BANK_NO = ?',
                        [currentBalance, nextDateStr, BANK_NO]
                    );
                }
            } else {
                // Insert new record with current balance
                if (hasYear && hasMonth) {
                    await connection.execute(
                        'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO, MYEAR, MONTHH) VALUES (?, ?, ?, ?, ?)',
                        [nextDateStr, currentBalance, BANK_NO, nextYear, nextMonth]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO) VALUES (?, ?, ?)',
                        [nextDateStr, currentBalance, BANK_NO]
                    );
                }
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

        // Check if MYEAR and MONTHH columns exist
        const [yearMonthColumns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'BAL_BANK' 
            AND COLUMN_NAME IN ('MYEAR', 'MONTHH')
        `);

        const hasYear = yearMonthColumns.some(c => c.COLUMN_NAME === 'MYEAR');
        const hasMonth = yearMonthColumns.some(c => c.COLUMN_NAME === 'MONTHH');

        if (!hasYear) {
            await connection.execute(`ALTER TABLE BAL_BANK ADD COLUMN MYEAR VARCHAR(4) NULL`);
        }
        if (!hasMonth) {
            await connection.execute(`ALTER TABLE BAL_BANK ADD COLUMN MONTHH INT NULL`);
        }

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

        if (hasYear && hasMonth) {
            await connection.execute(
                'UPDATE BAL_BANK SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ? AND BANK_NO = ?',
                [AMT, year, month, date, bankNo]
            );
        } else {
            await connection.execute(
                'UPDATE BAL_BANK SET AMT = ? WHERE RDATE = ? AND BANK_NO = ?',
                [AMT, date, bankNo]
            );
        }

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
                if (hasYear && hasMonth) {
                    await connection.execute(
                        'UPDATE BAL_BANK SET AMT = ?, MYEAR = ?, MONTHH = ? WHERE RDATE = ? AND BANK_NO = ?',
                        [currentBalance, nextYear, nextMonth, nextDateStr, bankNo]
                    );
                } else {
                    await connection.execute(
                        'UPDATE BAL_BANK SET AMT = ? WHERE RDATE = ? AND BANK_NO = ?',
                        [currentBalance, nextDateStr, bankNo]
                    );
                }
            } else {
                if (hasYear && hasMonth) {
                    await connection.execute(
                        'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO, MYEAR, MONTHH) VALUES (?, ?, ?, ?, ?)',
                        [nextDateStr, currentBalance, bankNo, nextYear, nextMonth]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO BAL_BANK (RDATE, AMT, BANK_NO) VALUES (?, ?, ?)',
                        [nextDateStr, currentBalance, bankNo]
                    );
                }
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
            const isTableNotExist = 
                tableError.code === 'ER_NO_SUCH_TABLE' ||
                tableError.code === '42S02' ||
                tableError.errno === 1146 ||
                (tableError.message && (
                    tableError.message.includes("doesn't exist") ||
                    tableError.message.includes("Unknown table")
                ));

            if (isTableNotExist) {
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

