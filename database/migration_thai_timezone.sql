-- ============================================
-- Migration Script: Thai Timezone Support
-- ============================================
-- วันที่: 2024-01-XX
-- คำอธิบาย: 
--   ✅ ไม่ต้องเพิ่ม field ใหม่ เพราะใช้ field เดิมอยู่แล้ว
--   ✅ แต่ต้องแก้ไข application code ให้ใช้เวลาไทย (Asia/Bangkok timezone)
--   ✅ Field ที่มีอยู่แล้ว:
--     * DAILY_QUEUE: QUEUE_DATE, QUEUE_TIME, CREATED_AT
--     * TREATMENT1: RDATE, TRDATE, PAYMENT_DATE, PAYMENT_TIME, SYSTEM_DATE, SYSTEM_TIME
--     * ตารางอื่นๆ: RDATE, TRDATE, CREATED_AT, etc.
--
-- สิ่งที่ต้องทำ:
--   1. ✅ แก้ไข application code ใน routes ให้ใช้เวลาไทยแทน CURDATE() และ CURTIME()
--   2. ✅ ตรวจสอบว่า MySQL server timezone ตั้งค่าเป็น Asia/Bangkok หรือไม่ (แนะนำ)
-- ============================================

-- ✅ ตรวจสอบ timezone ปัจจุบันของ MySQL
-- SELECT @@global.time_zone, @@session.time_zone;

-- ✅ ตั้งค่า timezone เป็น Asia/Bangkok (ถ้ายังไม่ได้ตั้ง)
-- SET GLOBAL time_zone = '+07:00';
-- SET time_zone = '+07:00';

-- ✅ หรือใช้คำสั่งนี้ใน MySQL config file (my.cnf หรือ my.ini):
-- [mysqld]
-- default-time-zone = '+07:00'

-- ============================================
-- ✅ หมายเหตุ: ไม่ต้องเพิ่ม field ใหม่
-- ============================================
-- Database schema มี field ที่จำเป็นอยู่แล้ว:
--
-- 1. DAILY_QUEUE table:
--    - QUEUE_DATE DATE (ใช้เก็บวันที่คิว)
--    - QUEUE_TIME TIME (ใช้เก็บเวลาคิว)
--    - CREATED_AT DATETIME (ใช้เก็บเวลาที่สร้าง)
--
-- 2. TREATMENT1 table:
--    - RDATE DATE (วันที่รับบริการ)
--    - TRDATE DATE (วันที่รับบริการจริง)
--    - PAYMENT_DATE DATE (วันที่ชำระเงิน)
--    - PAYMENT_TIME TIME (เวลาชำระเงิน)
--    - SYSTEM_DATE DATE (วันที่ของระบบ)
--    - SYSTEM_TIME TIME (เวลาของระบบ)
--
-- 3. ตารางอื่นๆ:
--    - RDATE, TRDATE, CREATED_AT, etc.
--
-- การแก้ไข:
--   - แก้ไข application code ใน routes ให้ใช้เวลาไทย (Asia/Bangkok timezone)
--   - แทนที่ CURDATE() และ CURTIME() ด้วย JavaScript functions ที่ใช้เวลาไทย
-- ============================================

-- ✅ ตรวจสอบว่า MySQL server timezone ตั้งค่าเป็น Asia/Bangkok หรือไม่
-- ถ้ายังไม่ได้ตั้ง ให้รันคำสั่งนี้ (ต้องมีสิทธิ์ SUPER):
-- 
-- SET GLOBAL time_zone = '+07:00';
-- 
-- หรือแก้ไขใน MySQL config file:
-- [mysqld]
-- default-time-zone = '+07:00'
--
-- แล้ว restart MySQL server

-- ✅ ตรวจสอบ timezone ปัจจุบัน
SELECT 
    @@global.time_zone AS 'Global Timezone',
    @@session.time_zone AS 'Session Timezone',
    NOW() AS 'Current MySQL Time',
    CONVERT_TZ(NOW(), @@session.time_zone, '+07:00') AS 'Thailand Time';

-- ✅ ตรวจสอบข้อมูลในตาราง (ตัวอย่าง)
-- SELECT 
--     QUEUE_ID,
--     QUEUE_DATE,
--     QUEUE_TIME,
--     CREATED_AT,
--     DATE_FORMAT(CREATED_AT, '%Y-%m-%d %H:%i:%s') AS 'Formatted Created At'
-- FROM DAILY_QUEUE
-- ORDER BY CREATED_AT DESC
-- LIMIT 10;

-- ✅ ตรวจสอบข้อมูล TREATMENT1
-- SELECT 
--     VNO,
--     RDATE,
--     PAYMENT_DATE,
--     PAYMENT_TIME,
--     SYSTEM_DATE,
--     SYSTEM_TIME
-- FROM TREATMENT1
-- ORDER BY RDATE DESC
-- LIMIT 10;

-- ============================================
-- ✅ สรุป: ไม่ต้องเพิ่ม field ใหม่
-- ============================================
-- Database schema มี field ที่จำเป็นอยู่แล้ว
-- การแก้ไขทำที่ application code ใน routes เท่านั้น
-- ============================================

