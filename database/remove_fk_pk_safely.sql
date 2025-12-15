-- ============================================
-- ลบ Foreign Key และ Primary Key อย่างปลอดภัย
-- สำหรับ TREATMENT1 และ TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ หมายเหตุ: 
-- 1. การลบ FK/PK อาจทำให้ข้อมูลไม่สอดคล้องกัน
-- 2. ควร backup ฐานข้อมูลก่อน
-- 3. ลบเฉพาะ FK/PK ที่มีปัญหา ไม่ใช่ทั้งหมด

-- ============================================
-- Step 1: ตรวจสอบ Foreign Keys ทั้งหมดก่อน
-- ============================================
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- ============================================
-- Step 2: ตรวจสอบ Primary Keys ทั้งหมด
-- ============================================
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND CONSTRAINT_NAME = 'PRIMARY'
ORDER BY TABLE_NAME;

-- ============================================
-- Step 3: ลบ Foreign Key ที่มีปัญหาเฉพาะ
-- (เฉพาะ TREATMENT1_DIAGNOSIS ที่อ้างอิง TREATMENT1)
-- ============================================

-- ตรวจสอบชื่อ Foreign Key constraint ก่อน
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME = 'TREATMENT1_DIAGNOSIS'
  AND REFERENCED_TABLE_NAME = 'TREATMENT1';

-- ลบ Foreign Key (ใช้ชื่อ constraint ที่ได้จาก query ด้านบน)
-- ตัวอย่าง: ถ้าชื่อ constraint คือ 'treatment1_diagnosis_ibfk_1'
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY treatment1_diagnosis_ibfk_1;

-- หรือใช้วิธีนี้ (ลบทุก FK ที่อ้างอิง TREATMENT1)
-- SET @sql = NULL;
-- SELECT GROUP_CONCAT(
--     CONCAT('ALTER TABLE ', TABLE_NAME, ' DROP FOREIGN KEY ', CONSTRAINT_NAME, ';')
--     SEPARATOR '\n'
-- ) INTO @sql
-- FROM information_schema.KEY_COLUMN_USAGE
-- WHERE TABLE_SCHEMA = 'goodapp_clinic'
--   AND REFERENCED_TABLE_NAME = 'TREATMENT1';
-- 
-- SELECT @sql;
-- PREPARE stmt FROM @sql;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- ============================================
-- Step 4: ลบ Primary Key จาก TREATMENT1 (ถ้าจำเป็น)
-- ============================================

-- ⚠️ ระวัง: การลบ Primary Key อาจทำให้ข้อมูลซ้ำกันได้
-- ตรวจสอบก่อนว่ามีข้อมูลซ้ำหรือไม่
SELECT VNO, COUNT(*) as count
FROM TREATMENT1
GROUP BY VNO
HAVING COUNT(*) > 1;

-- ถ้าไม่มีข้อมูลซ้ำ ให้ลบ Primary Key
-- ALTER TABLE TREATMENT1 DROP PRIMARY KEY;

-- ============================================
-- Step 5: ตรวจสอบผลลัพธ์
-- ============================================
SHOW CREATE TABLE TREATMENT1;
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- ============================================
-- Step 6: สร้าง FK/PK กลับมาหลังแก้ปัญหา
-- ============================================

-- สร้าง Primary Key กลับมา
-- ALTER TABLE TREATMENT1 ADD PRIMARY KEY (VNO);

-- สร้าง Foreign Key กลับมา
-- ALTER TABLE TREATMENT1_DIAGNOSIS 
-- ADD CONSTRAINT treatment1_diagnosis_ibfk_1 
-- FOREIGN KEY (VNO) REFERENCES TREATMENT1(VNO) 
-- ON DELETE CASCADE ON UPDATE CASCADE;



