-- ============================================
-- ลบ Foreign Key และ Primary Key (Step by Step)
-- สำหรับ TREATMENT1 และ TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ หมายเหตุสำคัญ:
-- 1. Backup ฐานข้อมูลก่อนรัน script นี้!
-- 2. รันทีละคำสั่ง ตรวจสอบผลลัพธ์ก่อนรันคำสั่งถัดไป
-- 3. ถ้า error ให้หยุดและตรวจสอบ

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

-- ดูผลลัพธ์จาก query ด้านบน แล้วใช้ชื่อ CONSTRAINT_NAME ในคำสั่งถัดไป
-- ตัวอย่าง: ถ้า CONSTRAINT_NAME = 'treatment1_diagnosis_ibfk_1'

-- ============================================
-- Step 2: ลบ Foreign Key จาก TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ แก้ไขชื่อ constraint ให้ตรงกับผลลัพธ์จาก Step 1
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY treatment1_diagnosis_ibfk_1;

-- หรือใช้วิธีนี้ (ลบทุก FK ที่อ้างอิง TREATMENT1)
SET @sql = NULL;
SELECT GROUP_CONCAT(
    CONCAT('ALTER TABLE ', TABLE_NAME, ' DROP FOREIGN KEY ', CONSTRAINT_NAME, ';')
    SEPARATOR '\n'
) INTO @sql
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND REFERENCED_TABLE_NAME = 'TREATMENT1'
  AND TABLE_NAME = 'TREATMENT1_DIAGNOSIS';

SELECT @sql as 'SQL to execute';
-- ถ้าพบ FK ให้ copy SQL ที่ได้จาก @sql แล้วรัน

-- ============================================
-- Step 3: ตรวจสอบว่า Foreign Key ถูกลบแล้ว
-- ============================================
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- ============================================
-- Step 4: ตรวจสอบ Primary Key ของ TREATMENT1
-- ============================================
SELECT 
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE,
    COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME = 'TREATMENT1'
  AND CONSTRAINT_NAME = 'PRIMARY';

-- ============================================
-- Step 5: ลบ Primary Key จาก TREATMENT1 (ถ้าจำเป็น)
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
-- Step 6: ตรวจสอบผลลัพธ์
-- ============================================
SHOW CREATE TABLE TREATMENT1;
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- ============================================
-- Step 7: ตรวจสอบว่าไม่มี FK/PK แล้ว
-- ============================================
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME IN ('TREATMENT1', 'TREATMENT1_DIAGNOSIS')
  AND CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY');


