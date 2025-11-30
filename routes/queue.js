// routes/queue.js - Complete Fixed Version
const express = require('express');
const router = express.Router();

// ✅ Function to get Thailand time (UTC+7) - แก้ไขให้ใช้เวลาไทยอย่างถูกต้อง
function getThailandTime() {
    const now = new Date();
    // ✅ ใช้ Intl.DateTimeFormat เพื่อดึงเวลาไทยโดยตรง
    const thailandTimeStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(now);
    
    // ✅ สร้าง Date object จากเวลาไทย
    const year = parseInt(thailandTimeStr.find(p => p.type === 'year').value);
    const month = parseInt(thailandTimeStr.find(p => p.type === 'month').value) - 1; // month is 0-indexed
    const day = parseInt(thailandTimeStr.find(p => p.type === 'day').value);
    const hour = parseInt(thailandTimeStr.find(p => p.type === 'hour').value);
    const minute = parseInt(thailandTimeStr.find(p => p.type === 'minute').value);
    const second = parseInt(thailandTimeStr.find(p => p.type === 'second').value);
    
    // ✅ สร้าง Date object โดยใช้เวลาไทย (แต่ต้องระวังว่า date object จะยังเป็น UTC internally)
    // ใช้วิธีอื่น: สร้าง string แล้วแปลงกลับเป็น date
    const thailandDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    return new Date(thailandDateStr + '+07:00'); // ✅ ระบุ timezone เป็น +07:00
}

// ✅ Function to format date for database (YYYY-MM-DD) - ใช้เวลาไทย
function formatDateForDB(date) {
    // ✅ ใช้ Intl.DateTimeFormat เพื่อดึงวันที่จากเวลาไทย
    const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
    
    return dateStr; // ✅ ได้รูปแบบ YYYY-MM-DD จากเวลาไทย
}

// ✅ Function to format time for database (HH:MM:SS) - ใช้เวลาไทย
function formatTimeForDB(date) {
    // ✅ ใช้ Intl.DateTimeFormat เพื่อดึงเวลาจากเวลาไทย
    const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
    
    return timeStr; // ✅ ได้รูปแบบ HH:MM:SS จากเวลาไทย
}

// ✅ Function to generate Queue ID using Thailand date - ใช้เวลาไทย
function generateQueueId(queueNumber, date = getThailandTime()) {
    // ✅ ใช้ Intl.DateTimeFormat เพื่อดึงวันที่จากเวลาไทย
    const thailandDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
    
    // ✅ ได้รูปแบบ YYYY-MM-DD จากเวลาไทย แล้วแปลงเป็น YYYYMMDD
    const dateStr = thailandDateStr.replace(/-/g, '');
    
    return `Q${dateStr}${String(queueNumber).padStart(3, '0')}`;
}

// GET today's queue - Using Thailand timezone
router.get('/today', async (req, res) => {
    try {
        const db = await require('../config/db');
        const thailandDate = formatDateForDB(getThailandTime());

        console.log(`📅 Fetching queue for Thailand date: ${thailandDate}`);

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
                dq.QUEUE_DATE,
                dq.SOCIAL_CARD,
                dq.UCS_CARD,
                -- Patient data
                p.HNCODE,
                p.PRENAME,
                p.NAME1,
                p.SURNAME,
                p.AGE,
                p.SEX,
                p.TEL1,
                p.SOCIAL_CARD as PATIENT_SOCIAL_CARD,
                p.UCS_CARD as PATIENT_UCS_CARD,
                p.DRUG_ALLERGY,
                p.DISEASE1,
                p.WEIGHT1,
                -- VN if exists (check from TREATMENT1)
                t.VNO,
                t.STATUS1 as TREATMENT_STATUS
            FROM DAILY_QUEUE dq
            LEFT JOIN patient1 p ON dq.HNCODE = p.HNCODE
            LEFT JOIN TREATMENT1 t ON dq.QUEUE_ID = t.QUEUE_ID
            WHERE DATE(dq.QUEUE_DATE) = ?
            ORDER BY dq.QUEUE_NUMBER
        `, [thailandDate]);

        console.log(`📊 Found ${rows.length} queue items`);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            date: thailandDate,
            thailandTime: getThailandTime().toISOString(),
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching today queue:', {
            message: error.message,
            code: error.code,
            sqlMessage: error.sqlMessage
        });

        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคิววันนี้',
            error: error.message,
            errorCode: error.code
        });
    }
});

// GET all queue (ไม่กรองตามวันที่) - สำหรับหน้าตรวจรักษา
router.get('/all', async (req, res) => {
    try {
        const db = await require('../config/db');

        console.log(`📅 Fetching all queue (no date filter)`);

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
                dq.QUEUE_DATE,
                dq.SOCIAL_CARD,
                dq.UCS_CARD,
                -- Patient data
                p.HNCODE,
                p.PRENAME,
                p.NAME1,
                p.SURNAME,
                p.AGE,
                p.SEX,
                p.TEL1,
                p.SOCIAL_CARD as PATIENT_SOCIAL_CARD,
                p.UCS_CARD as PATIENT_UCS_CARD,
                p.DRUG_ALLERGY,
                p.DISEASE1,
                p.WEIGHT1,
                -- VN if exists (check from TREATMENT1)
                t.VNO,
                t.STATUS1 as TREATMENT_STATUS
            FROM DAILY_QUEUE dq
            LEFT JOIN patient1 p ON dq.HNCODE = p.HNCODE
            LEFT JOIN TREATMENT1 t ON dq.QUEUE_ID = t.QUEUE_ID
            ORDER BY dq.QUEUE_DATE DESC, dq.QUEUE_NUMBER
        `);

        console.log(`📊 Found ${rows.length} queue items (all dates)`);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            thailandTime: getThailandTime().toISOString(),
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching all queue:', {
            message: error.message,
            code: error.code,
            sqlMessage: error.sqlMessage
        });

        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคิวทั้งหมด',
            error: error.message,
            errorCode: error.code
        });
    }
});

// GET today's appointments
router.get('/appointments/today', async (req, res) => {
    try {
        const db = await require('../config/db');
        const thailandDate = formatDateForDB(getThailandTime());

        const [rows] = await db.execute(`
            SELECT 
                a.APPOINTMENT_ID,
                a.APPOINTMENT_TIME,
                a.REASON,
                a.STATUS,
                a.VN_NUMBER,
                a.CREATED_AT,
                -- Patient data
                p.HNCODE,
                p.PRENAME,
                p.NAME1,
                p.SURNAME,
                p.AGE,
                p.SEX,
                p.TEL1,
                -- Doctor data
                doc.EMP_NAME as DOCTOR_NAME
            FROM APPOINTMENT_SCHEDULE a
            LEFT JOIN patient1 p ON a.HNCODE = p.HNCODE
            LEFT JOIN EMPLOYEE1 doc ON a.DOCTOR_CODE = doc.EMP_CODE
            WHERE DATE(a.APPOINTMENT_DATE) = ?
              AND a.STATUS IN ('นัดไว้', 'ยกเลิก')
            ORDER BY a.APPOINTMENT_TIME
        `, [thailandDate]);

        res.json({
            success: true,
            data: rows,
            count: rows.length,
            date: thailandDate
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

// POST create walk-in queue - Fixed version
router.post('/create', async (req, res) => {
    console.log('🚀 Queue creation started');
    console.log('📥 Request body:', req.body);
    console.log('🕐 Server time:', new Date().toISOString());
    console.log('🇹🇭 Thailand time:', getThailandTime().toISOString());

    const dbPool = await require('../config/db');
    let connection = null;

    try {
        const { HNCODE, CHIEF_COMPLAINT, CREATED_BY } = req.body;

        // Validate input
        if (!HNCODE || HNCODE.trim() === '') {
            console.log('❌ Invalid HNCODE:', HNCODE);
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Hospital Number ที่ถูกต้อง',
                received: { HNCODE, CHIEF_COMPLAINT, CREATED_BY }
            });
        }

        // Get connection
        connection = await dbPool.getConnection();
        console.log('✅ Database connection acquired');

        // Check if patient exists และดึง SOCIAL_CARD, UCS_CARD
        console.log('👤 Checking patient existence for HNCODE:', HNCODE);
        const [patientCheck] = await connection.execute(
            'SELECT HNCODE, PRENAME, NAME1, SURNAME, SOCIAL_CARD, UCS_CARD FROM patient1 WHERE HNCODE = ?',
            [HNCODE.trim()]
        );

        console.log('👤 Patient check result:', patientCheck.length, 'rows found');

        if (patientCheck.length === 0) {
            console.log('❌ Patient not found');
            return res.status(404).json({
                success: false,
                message: `ไม่พบข้อมูลผู้ป่วย HN: ${HNCODE}`,
                suggestion: 'กรุณาตรวจสอบ HN หรือลงทะเบียนผู้ป่วยใหม่',
                searchedHN: HNCODE
            });
        }

        const patient = patientCheck[0];
        console.log('✅ Patient found:', patient);

        // Get Thailand date/time for queue operations
        const thailandTime = getThailandTime();
        const queueDate = formatDateForDB(thailandTime);
        const queueTimeStr = formatTimeForDB(thailandTime);

        console.log('📅 Using Thailand date/time:', { queueDate, queueTimeStr });

        // Get next queue number for today (Thailand date)
        console.log('🔢 Getting next queue number...');
        const [queueCheck] = await connection.execute(`
            SELECT COALESCE(MAX(QUEUE_NUMBER), 0) + 1 as next_number
            FROM DAILY_QUEUE 
            WHERE DATE(QUEUE_DATE) = ?
        `, [queueDate]);

        const nextQueueNumber = queueCheck[0].next_number;
        console.log('🔢 Next queue number:', nextQueueNumber);

        // Generate Queue ID using Thailand date
        const queueId = generateQueueId(nextQueueNumber, thailandTime);
        console.log('🆔 Generated Queue ID:', queueId);

        // Start transaction
        console.log('🔄 Starting transaction...');
        await connection.beginTransaction();

        // Insert queue record พร้อม SOCIAL_CARD และ UCS_CARD
        console.log('💾 Inserting queue record...');
        const insertParams = [
            queueId,
            HNCODE.trim(),
            queueDate,
            nextQueueNumber,
            queueTimeStr,
            'รอตรวจ',
            'walk-in',
            (CHIEF_COMPLAINT || '').trim(),
            patient.SOCIAL_CARD || 'N',
            patient.UCS_CARD || 'N',
            thailandTime.toISOString()
        ];

        console.log('💾 Insert parameters:', insertParams);

        await connection.execute(`
            INSERT INTO DAILY_QUEUE (
                QUEUE_ID, HNCODE, QUEUE_DATE, QUEUE_NUMBER, QUEUE_TIME, 
                STATUS, TYPE, CHIEF_COMPLAINT, SOCIAL_CARD, UCS_CARD, CREATED_AT
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, insertParams);

        console.log('✅ Queue record inserted successfully');

        // Commit transaction
        await connection.commit();
        console.log('✅ Transaction committed');

        // Prepare response
        const response = {
            success: true,
            message: 'สร้างคิวสำเร็จ',
            data: {
                QUEUE_ID: queueId,
                VNO: null,
                QUEUE_NUMBER: nextQueueNumber,
                HNCODE: HNCODE.trim(),
                PATIENT_NAME: `${patient.PRENAME || ''}${patient.NAME1} ${patient.SURNAME || ''}`.trim(),
                TYPE: 'walk-in',
                STATUS: 'รอตรวจ',
                QUEUE_DATE: queueDate,
                QUEUE_TIME: queueTimeStr,
                SOCIAL_CARD: patient.SOCIAL_CARD || 'N',
                UCS_CARD: patient.UCS_CARD || 'N',
                THAILAND_TIME: thailandTime.toISOString(),
                SERVER_TIME: new Date().toISOString()
            }
        };

        console.log('✅ Queue created successfully:', response.data);
        res.status(201).json(response);

    } catch (error) {
        // Rollback transaction
        if (connection) {
            try {
                await connection.rollback();
                console.log('🔄 Transaction rolled back');
            } catch (rollbackError) {
                console.error('❌ Rollback failed:', rollbackError);
            }
        }

        // Log detailed error
        console.error('🚨 Queue creation error:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            sql: error.sql
        });

        // Determine error type and response
        let statusCode = 500;
        let message = 'เกิดข้อผิดพลาดในการสร้างคิว';

        if (error.code === 'ER_DUP_ENTRY') {
            statusCode = 409;
            message = 'Queue ID ซ้ำ กรุณาลองใหม่อีกครั้ง';
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            statusCode = 400;
            message = 'ข้อมูลอ้างอิงไม่ถูกต้อง';
        } else if (error.code === 'ER_BAD_FIELD_ERROR') {
            statusCode = 500;
            message = 'โครงสร้างฐานข้อมูลไม่ถูกต้อง';
        } else if (error.code === 'ECONNREFUSED') {
            statusCode = 503;
            message = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้';
        }

        res.status(statusCode).json({
            success: false,
            message: message,
            error: error.message,
            errorCode: error.code,
            sqlMessage: error.sqlMessage,
            debug: {
                thailand_time: getThailandTime().toISOString(),
                server_time: new Date().toISOString(),
                request_body: req.body
            }
        });

    } finally {
        // Release connection
        if (connection) {
            connection.release();
            console.log('🔌 Database connection released');
        }
    }
});

// POST appointment check-in
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

        // Check appointment และดึง SOCIAL_CARD, UCS_CARD
        const [appointmentCheck] = await connection.execute(`
            SELECT a.*, 
                   p.PRENAME, p.NAME1, p.SURNAME,
                   p.SOCIAL_CARD, p.UCS_CARD
            FROM APPOINTMENT_SCHEDULE a
            LEFT JOIN patient1 p ON a.HNCODE = p.HNCODE
            WHERE a.APPOINTMENT_ID = ? 
              AND DATE(a.APPOINTMENT_DATE) = ?
              AND a.STATUS = 'นัดไว้'
        `, [APPOINTMENT_ID, formatDateForDB(getThailandTime())]);

        if (appointmentCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบนัดหมายหรือนัดหมายไม่ใช่วันนี้'
            });
        }

        const appointment = appointmentCheck[0];
        const thailandTime = getThailandTime();
        const queueDate = formatDateForDB(thailandTime);

        // Get next queue number
        const [queueCheck] = await connection.execute(`
            SELECT COALESCE(MAX(QUEUE_NUMBER), 0) + 1 as next_number
            FROM DAILY_QUEUE 
            WHERE DATE(QUEUE_DATE) = ?
        `, [queueDate]);

        const nextQueueNumber = queueCheck[0].next_number;
        const queueId = generateQueueId(nextQueueNumber, thailandTime);

        await connection.beginTransaction();

        // Create queue from appointment พร้อม SOCIAL_CARD และ UCS_CARD
        await connection.execute(`
            INSERT INTO DAILY_QUEUE (
                QUEUE_ID, HNCODE, QUEUE_DATE, QUEUE_NUMBER, QUEUE_TIME, 
                STATUS, TYPE, CHIEF_COMPLAINT, APPOINTMENT_ID, 
                SOCIAL_CARD, UCS_CARD, CREATED_AT
            ) VALUES (?, ?, ?, ?, ?, 'รอตรวจ', 'appointment', ?, ?, ?, ?, ?)
        `, [
            queueId,
            appointment.HNCODE,
            queueDate,
            nextQueueNumber,
            formatTimeForDB(thailandTime),
            appointment.REASON,
            APPOINTMENT_ID,
            appointment.SOCIAL_CARD || 'N',
            appointment.UCS_CARD || 'N',
            thailandTime.toISOString()
        ]);

        // Update appointment status
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
                VNO: appointment.VN_NUMBER,
                QUEUE_NUMBER: nextQueueNumber,
                HNCODE: appointment.HNCODE,
                PATIENT_NAME: `${appointment.PRENAME || ''}${appointment.NAME1} ${appointment.SURNAME || ''}`.trim(),
                TYPE: 'appointment',
                APPOINTMENT_ID: APPOINTMENT_ID,
                SOCIAL_CARD: appointment.SOCIAL_CARD || 'N',
                UCS_CARD: appointment.UCS_CARD || 'N'
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

// PUT update queue status
router.put('/:queueId/status', async (req, res) => {
    const dbPool = await require('../config/db');
    let connection = null;

    try {
        const { queueId } = req.params;
        const { status } = req.body;

        console.log(`🔍 DEBUG: Updating queue status - QUEUE_ID: ${queueId}, Status: ${status}`);

        const validStatuses = ['รอตรวจ', 'กำลังตรวจ', 'เสร็จแล้ว', 'รอชำระเงิน', 'ชำระเงินแล้ว', 'ยกเลิกคิว'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'สถานะไม่ถูกต้อง ต้องเป็น: ' + validStatuses.join(', ')
            });
        }

        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // เช็คข้อมูลก่อนอัพเดท
        const [beforeUpdate] = await connection.execute(`
            SELECT VNO, STATUS1, SYMPTOM, DXCODE, TREATMENT1, INVESTIGATION_NOTES 
            FROM TREATMENT1 WHERE QUEUE_ID = ?
        `, [queueId]);

        if (beforeUpdate.length > 0) {
            console.log(`📋 BEFORE UPDATE - VNO: ${beforeUpdate[0].VNO}`);
            console.log(`📋 Current data:`, {
                STATUS1: beforeUpdate[0].STATUS1,
                SYMPTOM: beforeUpdate[0].SYMPTOM,
                DXCODE: beforeUpdate[0].DXCODE,
                TREATMENT1: beforeUpdate[0].TREATMENT1,
                INVESTIGATION_NOTES: beforeUpdate[0].INVESTIGATION_NOTES
            });
        }

        // Update queue status
        const [queueResult] = await connection.execute(
            'UPDATE DAILY_QUEUE SET STATUS = ? WHERE QUEUE_ID = ?',
            [status, queueId]
        );

        if (queueResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'ไม่พบคิวที่ระบุ'
            });
        }

        console.log(`✅ Queue status updated successfully`);

        // อัพเดท TREATMENT1 อย่างระมัดระวัง - เฉพาะ STATUS1
        if (beforeUpdate.length > 0) {
            const [treatmentResult] = await connection.execute(
                'UPDATE TREATMENT1 SET STATUS1 = ? WHERE QUEUE_ID = ? AND VNO = ?',
                [status, queueId, beforeUpdate[0].VNO]
            );

            console.log(`✅ Treatment status updated - affected rows: ${treatmentResult.affectedRows}`);

            // เช็คข้อมูลหลังอัพเดท
            const [afterUpdate] = await connection.execute(`
                SELECT VNO, STATUS1, SYMPTOM, DXCODE, TREATMENT1, INVESTIGATION_NOTES 
                FROM TREATMENT1 WHERE QUEUE_ID = ?
            `, [queueId]);

            if (afterUpdate.length > 0) {
                console.log(`📋 AFTER UPDATE - VNO: ${afterUpdate[0].VNO}`);
                console.log(`📋 Updated data:`, {
                    STATUS1: afterUpdate[0].STATUS1,
                    SYMPTOM: afterUpdate[0].SYMPTOM,
                    DXCODE: afterUpdate[0].DXCODE,
                    TREATMENT1: afterUpdate[0].TREATMENT1,
                    INVESTIGATION_NOTES: afterUpdate[0].INVESTIGATION_NOTES
                });

                // เปรียบเทียบข้อมูลก่อนและหลัง
                const fieldsToCheck = ['SYMPTOM', 'DXCODE', 'TREATMENT1', 'INVESTIGATION_NOTES'];
                let dataLost = false;

                fieldsToCheck.forEach(field => {
                    if (beforeUpdate[0][field] && !afterUpdate[0][field]) {
                        console.log(`🚨 DATA LOST: ${field} was "${beforeUpdate[0][field]}" now null`);
                        dataLost = true;
                    }
                });

                if (dataLost) {
                    console.log(`🚨 CRITICAL: Data loss detected! Rolling back...`);
                    await connection.rollback();
                    return res.status(500).json({
                        success: false,
                        message: 'ตรวจพบการสูญหายของข้อมูล การอัพเดทถูกยกเลิก',
                        error: 'Data loss prevented'
                    });
                }
            }
        } else {
            console.log(`⚠️ No TREATMENT1 record found for QUEUE_ID: ${queueId}`);
        }

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

        console.error('🚨 Error updating queue status:', error);
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

router.put('/:queueId/status-only', async (req, res) => {
    const dbPool = await require('../config/db');

    try {
        const { queueId } = req.params;
        const { status } = req.body;

        console.log(`🔍 STATUS-ONLY UPDATE: ${queueId} -> ${status}`);

        const validStatuses = ['รอตรวจ', 'กำลังตรวจ', 'เสร็จแล้ว', 'รอชำระเงิน', 'ชำระเงินแล้ว'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'สถานะไม่ถูกต้อง'
            });
        }

        // อัพเดทเฉพาะ DAILY_QUEUE
        const [queueResult] = await dbPool.execute(
            'UPDATE DAILY_QUEUE SET STATUS = ? WHERE QUEUE_ID = ?',
            [status, queueId]
        );

        if (queueResult.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบคิวที่ระบุ'
            });
        }

        // อัพเดทเฉพาะ STATUS1 ใน TREATMENT1 โดยไม่แตะฟิลด์อื่น
        await dbPool.execute(
            'UPDATE TREATMENT1 SET STATUS1 = ? WHERE QUEUE_ID = ?',
            [status, queueId]
        );

        console.log(`✅ Status-only update completed`);

        res.json({
            success: true,
            message: 'อัปเดตสถานะสำเร็จ (ไม่แตะข้อมูลอื่น)',
            data: { QUEUE_ID: queueId, STATUS: status }
        });

    } catch (error) {
        console.error('Error in status-only update:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ',
            error: error.message
        });
    }
});

// DELETE remove queue
router.delete('/:queueId', async (req, res) => {
    const dbPool = await require('../config/db');
    let connection = null;

    try {
        const { queueId } = req.params;

        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // หา VNO ทั้งหมดที่ผูกกับคิวนี้
        const [treatments] = await connection.execute(
            'SELECT VNO FROM TREATMENT1 WHERE QUEUE_ID = ?',
            [queueId]
        );

        // ลบข้อมูลที่อ้างอิงแต่ละ VNO แบบวนลูป (เลี่ยงปัญหา subquery)
        for (const row of treatments) {
            const vno = row.VNO;
            await connection.execute(
                'DELETE FROM TREATMENT1_DIAGNOSIS WHERE VNO = ?',
                [vno]
            );
            await connection.execute(
                'DELETE FROM TREATMENT1_DRUG WHERE VNO = ?',
                [vno]
            );
            await connection.execute(
                'DELETE FROM TREATMENT1_MED_PROCEDURE WHERE VNO = ?',
                [vno]
            );
            await connection.execute(
                'DELETE FROM TREATMENT1_LABORATORY WHERE VNO = ?',
                [vno]
            );
            await connection.execute(
                'DELETE FROM TREATMENT1_RADIOLOGICAL WHERE VNO = ?',
                [vno]
            );
        }

        // ลบ TREATMENT1 ที่ผูกกับคิวนี้ (ถ้ามี)
        await connection.execute(
            'DELETE FROM TREATMENT1 WHERE QUEUE_ID = ?',
            [queueId]
        );

        // Delete queue
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

        console.error('Error deleting queue:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            sql: error.sql
        });
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

// GET queue statistics
router.get('/stats', async (req, res) => {
    try {
        const db = await require('../config/db');
        const thailandDate = formatDateForDB(getThailandTime());

        // Today's stats
        const [todayStats] = await db.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN STATUS = 'รอตรวจ' THEN 1 END) as waiting,
                COUNT(CASE WHEN STATUS = 'กำลังตรวจ' THEN 1 END) as in_progress,
                COUNT(CASE WHEN STATUS = 'เสร็จแล้ว' THEN 1 END) as completed,
                COUNT(CASE WHEN STATUS = 'ชำระเงินแล้ว' THEN 1 END) as paid,
                COUNT(CASE WHEN TYPE = 'walk-in' THEN 1 END) as walk_in,
                COUNT(CASE WHEN TYPE = 'appointment' THEN 1 END) as appointment
            FROM DAILY_QUEUE 
            WHERE DATE(QUEUE_DATE) = ?
        `, [thailandDate]);

        // Today's appointments
        const [appointmentStats] = await db.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN STATUS = 'นัดไว้' THEN 1 END) as scheduled,
                COUNT(CASE WHEN STATUS = 'มาแล้ว' THEN 1 END) as arrived,
                COUNT(CASE WHEN STATUS = 'ไม่มา' THEN 1 END) as no_show,
                COUNT(CASE WHEN STATUS = 'ยกเลิก' THEN 1 END) as cancelled
            FROM APPOINTMENT_SCHEDULE 
            WHERE DATE(APPOINTMENT_DATE) = ?
        `, [thailandDate]);

        res.json({
            success: true,
            data: {
                today_queue: todayStats[0],
                today_appointments: appointmentStats[0],
                date: thailandDate,
                thailandTime: getThailandTime().toISOString(),
                lastUpdated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching queue statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติคิว',
            error: error.message
        });
    }
});

// Debug endpoint for timezone testing
router.get('/debug/time', (req, res) => {
    const serverTime = new Date();
    const thailandTime = getThailandTime();

    res.json({
        serverTime: serverTime.toISOString(),
        serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        thailandTime: thailandTime.toISOString(),
        thailandDateString: thailandTime.toLocaleDateString('th-TH'),
        formatForDB: formatDateForDB(thailandTime),
        timeForDB: formatTimeForDB(thailandTime),
        sampleQueueId: generateQueueId(1, thailandTime),
        comparison: {
            serverDate: formatDateForDB(serverTime),
            thailandDate: formatDateForDB(thailandTime),
            difference: `${Math.round((thailandTime.getTime() - serverTime.getTime()) / (1000 * 60 * 60))} hours`
        }
    });
});

// Test endpoint
router.get('/test', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [result] = await db.execute('SELECT "Queue API is working!" as message, NOW() as db_time');

        res.json({
            success: true,
            message: 'Queue API test successful',
            data: result[0],
            timestamps: {
                server: new Date().toISOString(),
                thailand: getThailandTime().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Queue API test failed',
            error: error.message
        });
    }
});

module.exports = router;