-- ============================================
-- ลบ Foreign Key และ Primary Key (Auto)
-- สำหรับ TREATMENT1 และ TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ หมายเหตุ: Script นี้จะลบ FK/PK อัตโนมัติ
-- ควร backup ก่อนรัน

USE goodapp_clinic;

-- ============================================
-- Step 1: ลบ Foreign Key จาก TREATMENT1_DIAGNOSIS
-- ============================================

-- หาชื่อ Foreign Key constraint
SET @fk_name = NULL;
SELECT CONSTRAINT_NAME INTO @fk_name
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'goodapp_clinic'
  AND TABLE_NAME = 'TREATMENT1_DIAGNOSIS'
  AND REFERENCED_TABLE_NAME = 'TREATMENT1'
LIMIT 1;

-- ถ้าพบ Foreign Key ให้ลบ
SELECT @fk_name as 'Foreign Key to drop';

SET @sql = IF(@fk_name IS NOT NULL, 
    CONCAT('ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY ', @fk_name),
    'SELECT "No Foreign Key found" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

SELECT @has_pk as 'Has Primary Key', @has_duplicates as 'Has Duplicates';

-- ถ้ามี Primary Key และไม่มีข้อมูลซ้ำ ให้ลบ
SET @sql = IF(@has_pk > 0 AND @has_duplicates = 0,
    'ALTER TABLE TREATMENT1 DROP PRIMARY KEY',
    'SELECT "Cannot drop Primary Key (has duplicates or no PK)" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- Step 3: ตรวจสอบผลลัพธ์
-- ============================================
SHOW CREATE TABLE TREATMENT1;
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;


