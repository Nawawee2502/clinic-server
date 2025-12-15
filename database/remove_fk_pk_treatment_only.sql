-- ============================================
-- ลบ Foreign Key เฉพาะ TREATMENT1_DIAGNOSIS
-- (ลบเฉพาะ FK ที่มีปัญหา ไม่ลบทั้งหมด)
-- ============================================

-- ⚠️ หมายเหตุ: 
-- 1. Backup ฐานข้อมูลก่อน
-- 2. ลบเฉพาะ FK ที่มีปัญหา (TREATMENT1_DIAGNOSIS -> TREATMENT1)
-- 3. ไม่ลบ FK/PK อื่นๆ

USE goodapp_clinic;

-- ============================================
-- Step 1: ตรวจสอบ Foreign Key ที่จะลบ
-- ============================================
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME = 'TREATMENT1_DIAGNOSIS'
  AND REFERENCED_TABLE_NAME = 'TREATMENT1';

-- ============================================
-- Step 2: ลบ Foreign Key
-- ============================================

-- วิธีที่ 1: ลบโดยใช้ชื่อ constraint ที่รู้
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY treatment1_diagnosis_ibfk_1;

-- วิธีที่ 2: ลบโดยค้นหาชื่อ constraint อัตโนมัติ
SET @constraint_name = (
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'goodapp_clinic'
      AND TABLE_NAME = 'TREATMENT1_DIAGNOSIS'
      AND REFERENCED_TABLE_NAME = 'TREATMENT1'
    LIMIT 1
);

SELECT @constraint_name as constraint_to_drop;

-- ถ้าพบ constraint ให้ลบ
-- SET @sql = CONCAT('ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY ', @constraint_name);
-- PREPARE stmt FROM @sql;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- ============================================
-- Step 3: ตรวจสอบผลลัพธ์
-- ============================================
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- ============================================
-- Step 4: (ถ้าจำเป็น) ลบ Primary Key จาก TREATMENT1
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

-- ============================================
-- Step 6: สร้าง FK/PK กลับมาหลังแก้ปัญหา
-- ============================================

-- สร้าง Primary Key กลับมา (ถ้าลบไปแล้ว)
-- ALTER TABLE TREATMENT1 ADD PRIMARY KEY (VNO);

-- สร้าง Foreign Key กลับมา (ถ้าลบไปแล้ว)
-- ALTER TABLE TREATMENT1_DIAGNOSIS 
-- ADD CONSTRAINT treatment1_diagnosis_ibfk_1 
-- FOREIGN KEY (VNO) REFERENCES TREATMENT1(VNO) 
-- ON DELETE CASCADE ON UPDATE CASCADE;



