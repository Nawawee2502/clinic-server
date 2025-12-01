// routes/appointments.js
const express = require('express');
const router = express.Router();

// GET all appointments with filters
router.get('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const {
            page = 1, limit = 50, status, doctor_code, hncode,
            date_from, date_to, search
        } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (status) {
            whereClause += ' AND a.STATUS = ?';
            params.push(status);
        }
        if (doctor_code) {
            whereClause += ' AND a.DOCTOR_CODE = ?';
            params.push(doctor_code);
        }
        if (hncode) {
            whereClause += ' AND a.HNCODE = ?';
            params.push(hncode);
        }
        if (date_from) {
            whereClause += ' AND a.APPOINTMENT_DATE >= ?';
            params.push(date_from);
        }
        if (date_to) {
            whereClause += ' AND a.APPOINTMENT_DATE <= ?';
            params.push(date_to);
        }
        if (search) {
            whereClause += ' AND (p.NAME1 LIKE ? OR p.SURNAME LIKE ? OR p.HNCODE LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const [rows] = await db.execute(`
            SELECT 
                a.APPOINTMENT_ID,
                a.APPOINTMENT_DATE,
                a.APPOINTMENT_TIME,
                a.REASON,
                a.STATUS,
                a.VN_NUMBER, -- ✅ เพิ่ม VN_NUMBER
                a.CREATED_AT,
                -- ข้อมูลผู้ป่วย
                p.HNCODE,
                p.PRENAME,
                p.NAME1,
                p.SURNAME,
                p.AGE,
                p.SEX,
                p.TEL1,
                -- ข้อมูลหมอ
                doc.EMP_NAME as DOCTOR_NAME,
                -- ข้อมูลผู้สร้างนัด
                creator.EMP_NAME as CREATED_BY_NAME
            FROM APPOINTMENT_SCHEDULE a
            JOIN patient1 p ON CONVERT(a.HNCODE USING utf8) = CONVERT(p.HNCODE USING utf8)
            LEFT JOIN EMPLOYEE1 doc ON CONVERT(a.DOCTOR_CODE USING utf8) = CONVERT(doc.EMP_CODE USING utf8)
            LEFT JOIN EMPLOYEE1 creator ON CONVERT(a.CREATED_BY USING utf8) = CONVERT(creator.EMP_CODE USING utf8)
            ${whereClause}
            ORDER BY a.APPOINTMENT_DATE DESC, a.APPOINTMENT_TIME DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        // Get total count
        const [countResult] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM APPOINTMENT_SCHEDULE a 
            JOIN patient1 p ON CONVERT(a.HNCODE USING utf8) = CONVERT(p.HNCODE USING utf8)
            ${whereClause}
        `, params);

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
        console.error('Error fetching appointments:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนัดหมาย',
            error: error.message
        });
    }
});

// GET appointment by ID
router.get('/:id', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { id } = req.params;
        const [rows] = await db.execute(`
            SELECT 
                a.*,
                -- ข้อมูลผู้ป่วย
                p.PRENAME,
                p.NAME1,
                p.SURNAME,
                p.AGE,
                p.SEX,
                p.IDNO,
                p.TEL1,
                p.ADDR1,
                -- ข้อมูลหมอ
                doc.EMP_NAME as DOCTOR_NAME,
                -- ข้อมูลผู้สร้างนัด
                creator.EMP_NAME as CREATED_BY_NAME
            FROM APPOINTMENT_SCHEDULE a
            JOIN patient1 p ON CONVERT(a.HNCODE USING utf8) = CONVERT(p.HNCODE USING utf8)
            LEFT JOIN EMPLOYEE1 doc ON CONVERT(a.DOCTOR_CODE USING utf8) = CONVERT(doc.EMP_CODE USING utf8)
            LEFT JOIN EMPLOYEE1 creator ON CONVERT(a.CREATED_BY USING utf8) = CONVERT(creator.EMP_CODE USING utf8)
            WHERE a.APPOINTMENT_ID = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลนัดหมาย'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนัดหมาย',
            error: error.message
        });
    }
});

// GET appointments by date range
router.get('/date/:date', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { date } = req.params;
        const { doctor_code, status } = req.query;

        let whereClause = 'WHERE a.APPOINTMENT_DATE = ?';
        let params = [date];

        if (doctor_code) {
            whereClause += ' AND a.DOCTOR_CODE = ?';
            params.push(doctor_code);
        }
        if (status) {
            whereClause += ' AND a.STATUS = ?';
            params.push(status);
        }

        const [rows] = await db.execute(`
            SELECT 
                a.APPOINTMENT_ID,
                a.APPOINTMENT_TIME,
                a.REASON,
                a.STATUS,
                -- ข้อมูลผู้ป่วย
                p.HNCODE,
                p.PRENAME,
                p.NAME1,
                p.SURNAME,
                p.AGE,
                p.TEL1,
                -- ข้อมูลหมอ
                doc.EMP_NAME as DOCTOR_NAME
            FROM APPOINTMENT_SCHEDULE a
            JOIN patient1 p ON CONVERT(a.HNCODE USING utf8) = CONVERT(p.HNCODE USING utf8)
            LEFT JOIN EMPLOYEE1 doc ON CONVERT(a.DOCTOR_CODE USING utf8) = CONVERT(doc.EMP_CODE USING utf8)
            ${whereClause}
            ORDER BY a.APPOINTMENT_TIME
        `, params);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            date: date
        });
    } catch (error) {
        console.error('Error fetching appointments by date:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนัดหมายตามวันที่',
            error: error.message
        });
    }
});

// GET appointments by patient HN
router.get('/patient/:hn', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { hn } = req.params;
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE a.HNCODE = ?';
        let params = [hn];

        if (status) {
            whereClause += ' AND a.STATUS = ?';
            params.push(status);
        }

        const [rows] = await db.execute(`
            SELECT 
                a.APPOINTMENT_ID,
                a.APPOINTMENT_DATE,
                a.APPOINTMENT_TIME,
                a.REASON,
                a.STATUS,
                a.CREATED_AT,
                doc.EMP_NAME as DOCTOR_NAME
            FROM APPOINTMENT_SCHEDULE a
            LEFT JOIN EMPLOYEE1 doc ON CONVERT(a.DOCTOR_CODE USING utf8) = CONVERT(doc.EMP_CODE USING utf8)
            ${whereClause}
            ORDER BY a.APPOINTMENT_DATE DESC, a.APPOINTMENT_TIME DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const [countResult] = await db.execute(`
            SELECT COUNT(*) as total FROM APPOINTMENT_SCHEDULE a ${whereClause}
        `, params);

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
        console.error('Error fetching appointments by patient:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนัดหมายของผู้ป่วย',
            error: error.message
        });
    }
});

// แก้ในส่วน POST create appointment
router.post('/', async (req, res) => {
    try {
        const db = await require('../config/db');
        const {
            HNCODE, APPOINTMENT_DATE, APPOINTMENT_TIME, REASON,
            DOCTOR_CODE, DOCTOR_NAME, NOTES, CREATED_BY
            // ✅ เพิ่ม DOCTOR_NAME และ NOTES
        } = req.body;

        console.log('📥 Received appointment data:', req.body);

        if (!HNCODE || !APPOINTMENT_DATE || !APPOINTMENT_TIME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Hospital Number, วันที่นัด และเวลานัด'
            });
        }

        // ✅ สร้าง VN Number สำหรับนัดหมาย
        const appointmentDate = new Date(APPOINTMENT_DATE);
        const buddhistYear = (appointmentDate.getFullYear() + 543).toString().slice(-2);
        const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
        const day = String(appointmentDate.getDate()).padStart(2, '0');

        // หาเลขรันนิ่งสำหรับวันที่นัด
        const [vnCount] = await db.execute(`
            SELECT COUNT(*) + 1 as next_number
            FROM APPOINTMENT_SCHEDULE 
            WHERE APPOINTMENT_DATE = ? AND VN_NUMBER IS NOT NULL
        `, [APPOINTMENT_DATE]);

        const runningNumber = vnCount[0].next_number.toString().padStart(3, '0');
        const vnNumber = `VN${buddhistYear}${month}${day}${runningNumber}`;

        // ✅ ถ้ามี DOCTOR_NAME แต่ไม่มี DOCTOR_CODE ให้แปลงชื่อเป็นรหัส
        let doctorCode = DOCTOR_CODE || null;
        let doctorName = DOCTOR_NAME || null;
        
        if (DOCTOR_NAME && !DOCTOR_CODE) {
            // ลองค้นหา DOCTOR_CODE จาก DOCTOR_NAME
            try {
                const [doctorRows] = await db.execute(
                    'SELECT EMP_CODE, EMP_NAME FROM EMPLOYEE1 WHERE EMP_NAME = ? LIMIT 1',
                    [DOCTOR_NAME]
                );
                if (doctorRows.length > 0) {
                    doctorCode = doctorRows[0].EMP_CODE;
                    doctorName = doctorRows[0].EMP_NAME;
                }
            } catch (err) {
                console.warn('Could not find doctor by name:', err);
            }
        }

        const safeData = {
            HNCODE: HNCODE || null,
            APPOINTMENT_DATE: APPOINTMENT_DATE || null,
            APPOINTMENT_TIME: APPOINTMENT_TIME || null,
            REASON: REASON || null,
            DOCTOR_CODE: doctorCode,
            DOCTOR_NAME: doctorName,
            NOTES: NOTES || null,
            CREATED_BY: CREATED_BY || null,
            VN_NUMBER: vnNumber // ✅ ใช้ VN Number ที่สร้างใหม่
        };

        // ตรวจสอบว่าผู้ป่วยมีอยู่จริง
        const [patientCheck] = await db.execute(
            'SELECT HNCODE, PRENAME, NAME1, SURNAME FROM patient1 WHERE HNCODE = ?',
            [safeData.HNCODE]
        );

        if (patientCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้ป่วย'
            });
        }

        // สร้าง APPOINTMENT_ID
        const [countResult] = await db.execute(`
            SELECT COUNT(*) + 1 as next_number 
            FROM APPOINTMENT_SCHEDULE 
            WHERE APPOINTMENT_DATE = ?
        `, [safeData.APPOINTMENT_DATE]);

        const appointmentId = `APT${safeData.APPOINTMENT_DATE.replace(/-/g, '')}${countResult[0].next_number.toString().padStart(3, '0')}`;

        // ✅ บันทึกพร้อม VN_NUMBER, NOTES และ DOCTOR_NAME
        const [result] = await db.execute(`
            INSERT INTO APPOINTMENT_SCHEDULE (
                APPOINTMENT_ID, HNCODE, APPOINTMENT_DATE, APPOINTMENT_TIME,
                REASON, NOTES, DOCTOR_CODE, DOCTOR_NAME, CREATED_BY, STATUS, VN_NUMBER
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'นัดไว้', ?)
        `, [
            appointmentId,
            safeData.HNCODE,
            safeData.APPOINTMENT_DATE,
            safeData.APPOINTMENT_TIME,
            safeData.REASON,
            safeData.NOTES,
            safeData.DOCTOR_CODE,
            safeData.DOCTOR_NAME,
            safeData.CREATED_BY,
            safeData.VN_NUMBER // ✅ VN Number รูปแบบใหม่
        ]);

        res.status(201).json({
            success: true,
            message: 'สร้างนัดหมายสำเร็จ',
            data: {
                APPOINTMENT_ID: appointmentId,
                HNCODE: safeData.HNCODE,
                PATIENT_NAME: `${patientCheck[0].PRENAME}${patientCheck[0].NAME1} ${patientCheck[0].SURNAME}`,
                APPOINTMENT_DATE: safeData.APPOINTMENT_DATE,
                APPOINTMENT_TIME: safeData.APPOINTMENT_TIME,
                REASON: safeData.REASON,
                VN_NUMBER: safeData.VN_NUMBER, // ✅ ส่ง VN Number กลับไป
                STATUS: 'นัดไว้'
            }
        });

    } catch (error) {
        console.error('❌ Error creating appointment:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างนัดหมาย',
            error: error.message
        });
    }
});

// PUT update appointment
router.put('/:id', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { id } = req.params;
        const {
            APPOINTMENT_DATE, APPOINTMENT_TIME, REASON, DOCTOR_CODE, DOCTOR_NAME, NOTES, STATUS
        } = req.body;

        // ตรวจสอบว่านัดหมายมีอยู่จริง
        const [appointmentCheck] = await db.execute(
            'SELECT APPOINTMENT_ID FROM APPOINTMENT_SCHEDULE WHERE APPOINTMENT_ID = ?',
            [id]
        );

        if (appointmentCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลนัดหมาย'
            });
        }

        // ตรวจสอบความซ้ำของเวลานัด (ถ้าเปลี่ยนเวลาหรือหมอ)
        if (APPOINTMENT_DATE && APPOINTMENT_TIME && DOCTOR_CODE) {
            const [timeCheck] = await db.execute(`
                SELECT APPOINTMENT_ID 
                FROM APPOINTMENT_SCHEDULE 
                WHERE APPOINTMENT_DATE = ? AND APPOINTMENT_TIME = ? AND DOCTOR_CODE = ? 
                  AND STATUS = 'นัดไว้' AND APPOINTMENT_ID != ?
            `, [APPOINTMENT_DATE, APPOINTMENT_TIME, DOCTOR_CODE, id]);

            if (timeCheck.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'มีนัดหมายในช่วงเวลานี้แล้ว'
                });
            }
        }

        // ✅ ถ้ามี DOCTOR_NAME แต่ไม่มี DOCTOR_CODE ให้แปลงชื่อเป็นรหัส
        let doctorCode = DOCTOR_CODE || null;
        let doctorName = DOCTOR_NAME || null;
        
        if (DOCTOR_NAME && !DOCTOR_CODE) {
            try {
                const [doctorRows] = await db.execute(
                    'SELECT EMP_CODE, EMP_NAME FROM EMPLOYEE1 WHERE EMP_NAME = ? LIMIT 1',
                    [DOCTOR_NAME]
                );
                if (doctorRows.length > 0) {
                    doctorCode = doctorRows[0].EMP_CODE;
                    doctorName = doctorRows[0].EMP_NAME;
                }
            } catch (err) {
                console.warn('Could not find doctor by name:', err);
            }
        }

        const [result] = await db.execute(`
            UPDATE APPOINTMENT_SCHEDULE SET 
                APPOINTMENT_DATE = COALESCE(?, APPOINTMENT_DATE),
                APPOINTMENT_TIME = COALESCE(?, APPOINTMENT_TIME),
                REASON = COALESCE(?, REASON),
                NOTES = COALESCE(?, NOTES),
                DOCTOR_CODE = COALESCE(?, DOCTOR_CODE),
                DOCTOR_NAME = COALESCE(?, DOCTOR_NAME),
                STATUS = COALESCE(?, STATUS)
            WHERE APPOINTMENT_ID = ?
        `, [APPOINTMENT_DATE, APPOINTMENT_TIME, REASON, NOTES, doctorCode, doctorName, STATUS, id]);

        res.json({
            success: true,
            message: 'แก้ไขนัดหมายสำเร็จ',
            data: {
                APPOINTMENT_ID: id,
                APPOINTMENT_DATE,
                APPOINTMENT_TIME,
                REASON,
                STATUS
            }
        });
    } catch (error) {
        console.error('Error updating appointment:', error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({
                success: false,
                message: 'ไม่พบข้อมูลหมอที่ระบุ'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการแก้ไขนัดหมาย',
                error: error.message
            });
        }
    }
});

// PUT update appointment status
router.put('/:id/status', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { id } = req.params;
        const { status, cancelled_reason } = req.body;

        const validStatuses = ['นัดไว้', 'มาแล้ว', 'ไม่มา', 'ยกเลิก'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'สถานะไม่ถูกต้อง ต้องเป็น: ' + validStatuses.join(', ')
            });
        }

        let updateFields = 'STATUS = ?';
        let params = [status];

        if (status === 'ยกเลิก' && cancelled_reason) {
            updateFields += ', CANCELLED_REASON = ?, CANCELLED_AT = NOW()';
            params.push(cancelled_reason);
        }

        params.push(id);

        const [result] = await db.execute(
            `UPDATE APPOINTMENT_SCHEDULE SET ${updateFields} WHERE APPOINTMENT_ID = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลนัดหมาย'
            });
        }

        res.json({
            success: true,
            message: 'อัปเดตสถานะนัดหมายสำเร็จ',
            data: {
                APPOINTMENT_ID: id,
                STATUS: status,
                CANCELLED_REASON: cancelled_reason || null
            }
        });

    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะนัดหมาย',
            error: error.message
        });
    }
});

// DELETE appointment
router.delete('/:id', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { id } = req.params;

        // ตรวจสอบว่านัดหมายยังไม่ได้เข้าคิว
        const [queueCheck] = await db.execute(
            'SELECT QUEUE_ID FROM DAILY_QUEUE WHERE APPOINTMENT_ID = ?',
            [id]
        );

        if (queueCheck.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากนัดหมายนี้เข้าคิวแล้ว'
            });
        }

        const [result] = await db.execute(
            'DELETE FROM APPOINTMENT_SCHEDULE WHERE APPOINTMENT_ID = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลนัดหมายที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบนัดหมายสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบนัดหมาย',
            error: error.message
        });
    }
});

// GET appointment statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { date_from, date_to } = req.query;

        let dateFilter = '';
        let params = [];

        if (date_from && date_to) {
            dateFilter = 'WHERE APPOINTMENT_DATE BETWEEN ? AND ?';
            params = [date_from, date_to];
        } else if (date_from) {
            dateFilter = 'WHERE APPOINTMENT_DATE >= ?';
            params = [date_from];
        } else if (date_to) {
            dateFilter = 'WHERE APPOINTMENT_DATE <= ?';
            params = [date_to];
        }

        // Total appointments
        const [totalCount] = await db.execute(
            `SELECT COUNT(*) as total FROM APPOINTMENT_SCHEDULE ${dateFilter}`,
            params
        );

        // Appointments by status
        const [statusStats] = await db.execute(`
            SELECT STATUS, COUNT(*) as count 
            FROM APPOINTMENT_SCHEDULE ${dateFilter}
            GROUP BY STATUS
        `, params);

        // Appointments by doctor
        const [doctorStats] = await db.execute(`
            SELECT 
                e.EMP_NAME,
                COUNT(a.APPOINTMENT_ID) as appointment_count
            FROM APPOINTMENT_SCHEDULE a
            LEFT JOIN EMPLOYEE1 e ON CONVERT(a.DOCTOR_CODE USING utf8) = CONVERT(e.EMP_CODE USING utf8)
            ${dateFilter}
            GROUP BY a.DOCTOR_CODE, e.EMP_NAME
            ORDER BY appointment_count DESC
            LIMIT 10
        `, params);

        // Daily appointment counts
        const [dailyStats] = await db.execute(`
            SELECT 
                APPOINTMENT_DATE,
                COUNT(*) as count
            FROM APPOINTMENT_SCHEDULE ${dateFilter}
            GROUP BY APPOINTMENT_DATE
            ORDER BY APPOINTMENT_DATE DESC
            LIMIT 30
        `, params);

        res.json({
            success: true,
            data: {
                totalAppointments: totalCount[0].total,
                byStatus: statusStats,
                byDoctor: doctorStats,
                dailyCounts: dailyStats,
                dateRange: { date_from, date_to },
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching appointment statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติข้อมูลนัดหมาย',
            error: error.message
        });
    }
});

module.exports = router;