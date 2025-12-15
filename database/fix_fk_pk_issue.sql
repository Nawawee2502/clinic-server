-- ============================================
-- แก้ไขปัญหา Foreign Key และ Primary Key
-- สำหรับ TREATMENT1 และ TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ หมายเหตุ: รันคำสั่งนี้ในฐานข้อมูล goodapp_clinic บน goodappdev.com

-- Step 1: ตรวจสอบว่า TREATMENT1.VNO มี Primary Key หรือไม่
SELECT 
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE,
    COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME = 'TREATMENT1'
  AND CONSTRAINT_NAME = 'PRIMARY';

-- Step 2: ถ้าไม่มี Primary Key ให้เพิ่ม
-- ⚠️ ตรวจสอบก่อนว่า VNO ไม่ซ้ำและไม่มี NULL
SELECT VNO, COUNT(*) as count
FROM TREATMENT1
GROUP BY VNO
HAVING COUNT(*) > 1;

SELECT COUNT(*) as null_count
FROM TREATMENT1
WHERE VNO IS NULL OR VNO = '';

-- ถ้าไม่มีข้อมูลซ้ำและไม่มี NULL ให้รัน:
-- ALTER TABLE TREATMENT1 ADD PRIMARY KEY (VNO);

-- Step 3: ตรวจสอบ Foreign Key Constraint ของ TREATMENT1_DIAGNOSIS
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME = 'TREATMENT1_DIAGNOSIS'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Step 4: ตรวจสอบ Collation ของ VNO ในทั้งสองตาราง
-- Foreign Key ต้องมี Collation เดียวกัน
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    COLLATION_NAME,
    CHARACTER_SET_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME IN ('TREATMENT1', 'TREATMENT1_DIAGNOSIS')
  AND COLUMN_NAME = 'VNO';

-- Step 5: ถ้า Collation ไม่ตรงกัน ให้แก้ไข
-- ตัวอย่าง: ถ้า TREATMENT1.VNO เป็น utf8mb4_general_ci แต่ TREATMENT1_DIAGNOSIS.VNO เป็น utf8mb4_unicode_ci
-- ALTER TABLE TREATMENT1_DIAGNOSIS MODIFY COLUMN VNO VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- Step 6: ตรวจสอบว่า Foreign Key ถูกต้องหรือไม่
-- ถ้า Foreign Key ไม่ถูกต้อง อาจต้องลบและสร้างใหม่
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY treatment1_diagnosis_ibfk_1;
-- ALTER TABLE TREATMENT1_DIAGNOSIS 
-- ADD CONSTRAINT treatment1_diagnosis_ibfk_1 
-- FOREIGN KEY (VNO) REFERENCES TREATMENT1(VNO) 
-- ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 7: ตรวจสอบข้อมูลที่ผิดพลาด (VNO ใน TREATMENT1_DIAGNOSIS ที่ไม่มีใน TREATMENT1)
SELECT DISTINCT d.VNO
FROM TREATMENT1_DIAGNOSIS d
LEFT JOIN TREATMENT1 t ON d.VNO = t.VNO
WHERE t.VNO IS NULL;

-- Step 8: ลบข้อมูลที่ผิดพลาด (ถ้ามี)
-- DELETE FROM TREATMENT1_DIAGNOSIS 
-- WHERE VNO NOT IN (SELECT VNO FROM TREATMENT1);

-- Step 9: ตรวจสอบผลลัพธ์
SHOW CREATE TABLE TREATMENT1;
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;



