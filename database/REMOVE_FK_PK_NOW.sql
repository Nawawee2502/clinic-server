-- ============================================
-- ลบ Foreign Key และ Primary Key (พร้อมรัน)
-- สำหรับ TREATMENT1 และ TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ หมายเหตุสำคัญ:
-- 1. Backup ฐานข้อมูลก่อนรัน script นี้!
-- 2. Script นี้จะลบ FK/PK อัตโนมัติ
-- 3. ใช้กับฐานข้อมูล: goodapp_clinic

USE goodapp_clinic;

-- ============================================
-- Step 1: ลบ Foreign Key จาก TREATMENT1_DIAGNOSIS
-- ============================================

-- หาชื่อ Foreign Key constraint และลบทันที
SET @fk_name = NULL;
SELECT CONSTRAINT_NAME INTO @fk_name
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME = 'TREATMENT1_DIAGNOSIS'
  AND REFERENCED_TABLE_NAME = 'TREATMENT1'
LIMIT 1;

-- ถ้าพบ Foreign Key ให้ลบ
SET @sql = IF(@fk_name IS NOT NULL, 
    CONCAT('ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY ', @fk_name),
    'SELECT "No Foreign Key found to drop" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT CONCAT('Foreign Key dropped: ', IFNULL(@fk_name, 'None found')) as result;

-- ============================================
-- Step 2: ลบ Primary Key จาก TREATMENT1
-- ============================================

-- ตรวจสอบว่ามี Primary Key หรือไม่
SET @has_pk = (
    SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'goodapp_clinic'
      AND TABLE_NAME = 'TREATMENT1'
      AND CONSTRAINT_NAME = 'PRIMARY'
);

-- ตรวจสอบว่ามีข้อมูลซ้ำหรือไม่
SET @has_duplicates = (
    SELECT COUNT(*)
    FROM (
        SELECT VNO, COUNT(*) as cnt
        FROM TREATMENT1
        GROUP BY VNO
        HAVING COUNT(*) > 1
    ) as dup_check
);

-- ถ้ามี Primary Key และไม่มีข้อมูลซ้ำ ให้ลบ
SET @sql = IF(@has_pk > 0 AND @has_duplicates = 0,
    'ALTER TABLE TREATMENT1 DROP PRIMARY KEY',
    CONCAT('SELECT "Cannot drop Primary Key - Has PK: ', @has_pk, ', Has Duplicates: ', @has_duplicates, '" as message')
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT CONCAT('Primary Key dropped: ', IF(@has_pk > 0 AND @has_duplicates = 0, 'Yes', 'No (has duplicates or no PK)')) as result;

-- ============================================
-- Step 3: ตรวจสอบผลลัพธ์
-- ============================================

SELECT '=== TREATMENT1 Structure ===' as info;
SHOW CREATE TABLE TREATMENT1;

SELECT '=== TREATMENT1_DIAGNOSIS Structure ===' as info;
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- ============================================
-- Step 4: ตรวจสอบว่าไม่มี FK/PK แล้ว
-- ============================================

SELECT 
    TABLE_NAME,
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME IN ('TREATMENT1', 'TREATMENT1_DIAGNOSIS')
  AND CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY');

SELECT '=== Done! FK/PK removed ===' as result;


