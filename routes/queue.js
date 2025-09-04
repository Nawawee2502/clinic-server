// routes/queue.js - แก้ไขแล้ว: ไม่สร้าง TREATMENT1 ตอนสร้างคิว
const express = require('express');
const router = express.Router();

// GET today's queue - ดึงคิววันนี้
router.get('/today', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT 
                dq.QUEUE_ID,
                dq.QUEUE_NUMBER,
                dq.QUEUE_TIME,
                dq.STATUS,
                dq.TYPE,
                dq.CHIEF_COMPLAINT,
                dq.APPOINTMENT_ID,
                dq.CREATED_AT,
                -- ข้อมูลผู้ป่วย
                p.HNCODE,
                p.PRENAME,
                p.NAME1,
                p.SURNAME,
                p.AGE,
                p.SEX,
                p.TEL1,
                -- VN ถ้ามี (เช็คจาก TREATMENT1)
                t.VNO,
                t.STATUS1 as TREATMENT_STATUS
            FROM DAILY_QUEUE dq
            JOIN patient1 p ON CONVERT(dq.HNCODE USING utf8) = CONVERT(p.HNCODE USING utf8)
            LEFT JOIN TREATMENT1 t ON dq.QUEUE_ID = t.QUEUE_ID
            WHERE dq.QUEUE_DATE = CURDATE()
            ORDER BY dq.QUEUE_NUMBER
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            date: new Date().toISOString().split('T')[0]
        });
    } catch (error) {
        console.error('Error fetching today queue:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคิววันนี้',
            error: error.message
        });
    }
});

// GET today's appointments - ดึงนัดหมายวันนี้
router.get('/appointments/today', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute(`
            SELECT 
                a.APPOINTMENT_ID,
                a.APPOINTMENT_TIME,
                a.REASON,
                a.STATUS,
                a.VN_NUMBER,
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
                doc.EMP_NAME as DOCTOR_NAME
            FROM APPOINTMENT_SCHEDULE a
            JOIN patient1 p ON CONVERT(a.HNCODE USING utf8) = CONVERT(p.HNCODE USING utf8)
            LEFT JOIN EMPLOYEE1 doc ON CONVERT(a.DOCTOR_CODE USING utf8) = CONVERT(doc.EMP_CODE USING utf8)
            WHERE a.APPOINTMENT_DATE = CURDATE()
              AND a.STATUS IN ('นัดไว้', 'ยกเลิก')
            ORDER BY a.APPOINTMENT_TIME
        `);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            date: new Date().toISOString().split('T')[0]
        });
    } catch (error) {
        console.error('Error fetching today appointments:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลนัดหมายวันนี้',
            error: error.message
        });
    }
});

// 🔥 แก้ไข: POST create walk-in queue - สร้างแค่คิว ไม่สร้าง TREATMENT1
router.post('/create', async (req, res) => {
    const dbPool = await require('../config/db');
    let connection = null;

    try {
        const { HNCODE, CHIEF_COMPLAINT, CREATED_BY } = req.body;

        if (!HNCODE) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Hospital Number'
            });
        }

        connection = await dbPool.getConnection();

        // ตรวจสอบว่าผู้ป่วยมีอยู่จริง
        const [patientCheck] = await connection.execute(
            'SELECT HNCODE, PRENAME, NAME1, SURNAME FROM patient1 WHERE HNCODE = ?',
            [HNCODE]
        );

        if (patientCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลผู้ป่วย'
            });
        }

        // หาหมายเลขคิวถัดไป
        const [queueCheck] = await connection.execute(`
            SELECT COALESCE(MAX(QUEUE_NUMBER), 0) + 1 as next_number
            FROM DAILY_QUEUE 
            WHERE QUEUE_DATE = CURDATE()
        `);

        const nextQueueNumber = queueCheck[0].next_number;
        const today = new Date();
        const queueId = `Q${today.toISOString().split('T')[0].replace(/-/g, '')}${nextQueueNumber.toString().padStart(3, '0')}`;

        await connection.beginTransaction();

        // ✅ สร้างแค่คิว ไม่สร้าง TREATMENT1 (ให้หน้าตรวจรักษาสร้างเอง)
        await connection.execute(`
            INSERT INTO DAILY_QUEUE (
                QUEUE_ID, HNCODE, QUEUE_DATE, QUEUE_NUMBER, QUEUE_TIME, 
                STATUS, TYPE, CHIEF_COMPLAINT, CREATED_AT
            ) VALUES (?, ?, CURDATE(), ?, CURTIME(), 'รอตรวจ', 'walk-in', ?, NOW())
        `, [queueId, HNCODE, nextQueueNumber, CHIEF_COMPLAINT]);

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'สร้างคิวสำเร็จ',
            data: {
                QUEUE_ID: queueId,
                VNO: null, // ✅ จะสร้างทีหลังเมื่อเริ่มตรวจ
                QUEUE_NUMBER: nextQueueNumber,
                HNCODE: HNCODE,
                PATIENT_NAME: `${patientCheck[0].PRENAME}${patientCheck[0].NAME1} ${patientCheck[0].SURNAME}`,
                TYPE: 'walk-in'
            }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }

        console.error('Error creating queue:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างคิว',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// 🔥 แก้ไข: POST appointment check-in - สร้างแค่คิว ไม่สร้าง TREATMENT1
router.post('/checkin', async (req, res) => {
    const dbPool = await require('../config/db');
    let connection = null;

    try {
        const { APPOINTMENT_ID } = req.body;

        if (!APPOINTMENT_ID) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Appointment ID'
            });
        }

        connection = await dbPool.getConnection();

        // ตรวจสอบนัดหมายและดึง VN_NUMBER
        const [appointmentCheck] = await connection.execute(`
            SELECT a.*, p.PRENAME, p.NAME1, p.SURNAME
            FROM APPOINTMENT_SCHEDULE a
            JOIN patient1 p ON CONVERT(a.HNCODE USING utf8) = CONVERT(p.HNCODE USING utf8)
            WHERE a.APPOINTMENT_ID = ? 
              AND a.APPOINTMENT_DATE = CURDATE() 
              AND a.STATUS = 'นัดไว้'
        `, [APPOINTMENT_ID]);

        if (appointmentCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบนัดหมายหรือนัดหมายไม่ใช่วันนี้'
            });
        }

        const appointment = appointmentCheck[0];

        // หาหมายเลขคิวถัดไป
        const [queueCheck] = await connection.execute(`
            SELECT COALESCE(MAX(QUEUE_NUMBER), 0) + 1 as next_number
            FROM DAILY_QUEUE 
            WHERE QUEUE_DATE = CURDATE()
        `);

        const nextQueueNumber = queueCheck[0].next_number;
        const queueId = `Q${new Date().toISOString().split('T')[0].replace(/-/g, '')}${nextQueueNumber.toString().padStart(3, '0')}`;

        await connection.beginTransaction();

        // ✅ สร้างแค่คิวจากนัดหมาย ไม่สร้าง TREATMENT1
        await connection.execute(`
            INSERT INTO DAILY_QUEUE (
                QUEUE_ID, HNCODE, QUEUE_DATE, QUEUE_NUMBER, QUEUE_TIME, 
                STATUS, TYPE, CHIEF_COMPLAINT, APPOINTMENT_ID, CREATED_AT
            ) VALUES (?, ?, CURDATE(), ?, CURTIME(), 'รอตรวจ', 'appointment', ?, ?, NOW())
        `, [queueId, appointment.HNCODE, nextQueueNumber, appointment.REASON, APPOINTMENT_ID]);

        // อัปเดตสถานะนัดหมาย
        await connection.execute(`
            UPDATE APPOINTMENT_SCHEDULE 
            SET STATUS = 'มาแล้ว' 
            WHERE APPOINTMENT_ID = ?
        `, [APPOINTMENT_ID]);

        await connection.commit();

        res.json({
            success: true,
            message: 'เช็คอินสำเร็จ',
            data: {
                QUEUE_ID: queueId,
                VNO: appointment.VN_NUMBER, // ✅ ส่ง VN จากนัดหมายไปก่อน แต่จะสร้าง TREATMENT1 ทีหลัง
                QUEUE_NUMBER: nextQueueNumber,
                HNCODE: appointment.HNCODE,
                PATIENT_NAME: `${appointment.PRENAME}${appointment.NAME1} ${appointment.SURNAME}`,
                TYPE: 'appointment',
                APPOINTMENT_ID: APPOINTMENT_ID
            }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }

        console.error('Error checking in appointment:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเช็คอิน',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// PUT update queue status - อัปเดตสถานะคิว
router.put('/:queueId/status', async (req, res) => {
    const dbPool = await require('../config/db');
    let connection = null;

    try {
        const { queueId } = req.params;
        const { status } = req.body;

        const validStatuses = ['รอตรวจ', 'กำลังตรวจ', 'เสร็จแล้ว'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'สถานะไม่ถูกต้อง ต้องเป็น: ' + validStatuses.join(', ')
            });
        }

        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // อัปเดตสถานะคิว
        const [queueResult] = await connection.execute(
            'UPDATE DAILY_QUEUE SET STATUS = ? WHERE QUEUE_ID = ?',
            [status, queueId]
        );

        if (queueResult.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบคิวที่ระบุ'
            });
        }

        // อัปเดตสถานะใน TREATMENT1 ด้วย (ถ้ามี)
        await connection.execute(
            'UPDATE TREATMENT1 SET STATUS1 = ? WHERE QUEUE_ID = ?',
            [status, queueId]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'อัปเดตสถานะสำเร็จ',
            data: { QUEUE_ID: queueId, STATUS: status }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }

        console.error('Error updating queue status:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// DELETE remove queue - ลบคิว (กรณีผู้ป่วยไม่มา)
router.delete('/:queueId', async (req, res) => {
    const dbPool = await require('../config/db');
    let connection = null;

    try {
        const { queueId } = req.params;

        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // ลบ TREATMENT1 record (ถ้ามี)
        await connection.execute('DELETE FROM TREATMENT1 WHERE QUEUE_ID = ?', [queueId]);

        // ลบคิว
        const [result] = await connection.execute('DELETE FROM DAILY_QUEUE WHERE QUEUE_ID = ?', [queueId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบคิวที่ต้องการลบ'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'ลบคิวสำเร็จ'
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error rolling back transaction:', rollbackError);
            }
        }

        console.error('Error deleting queue:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบคิว',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// GET queue statistics - สถิติคิว
router.get('/stats', async (req, res) => {
    try {
        const db = await require('../config/db');

        // สถิติวันนี้
        const [todayStats] = await db.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN STATUS = 'รอตรวจ' THEN 1 END) as waiting,
                COUNT(CASE WHEN STATUS = 'กำลังตรวจ' THEN 1 END) as in_progress,
                COUNT(CASE WHEN STATUS = 'เสร็จแล้ว' THEN 1 END) as completed,
                COUNT(CASE WHEN TYPE = 'walk-in' THEN 1 END) as walk_in,
                COUNT(CASE WHEN TYPE = 'appointment' THEN 1 END) as appointment
            FROM DAILY_QUEUE 
            WHERE QUEUE_DATE = CURDATE()
        `);

        // นัดหมายวันนี้
        const [appointmentStats] = await db.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN STATUS = 'นัดไว้' THEN 1 END) as scheduled,
                COUNT(CASE WHEN STATUS = 'มาแล้ว' THEN 1 END) as arrived,
                COUNT(CASE WHEN STATUS = 'ไม่มา' THEN 1 END) as no_show,
                COUNT(CASE WHEN STATUS = 'ยกเลิก' THEN 1 END) as cancelled
            FROM APPOINTMENT_SCHEDULE 
            WHERE APPOINTMENT_DATE = CURDATE()
        `);

        res.json({
            success: true,
            data: {
                today_queue: todayStats[0],
                today_appointments: appointmentStats[0],
                date: new Date().toISOString().split('T')[0],
                lastUpdated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching queue statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติคิู',
            error: error.message
        });
    }
});

module.exports = router;