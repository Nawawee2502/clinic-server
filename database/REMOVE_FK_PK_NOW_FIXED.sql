-- ============================================
-- ลบ Foreign Key และ Primary Key (แก้ไขแล้ว - ไม่ใช้ information_schema)
-- สำหรับ TREATMENT1 และ TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ หมายเหตุสำคัญ:
-- 1. Backup ฐานข้อมูลก่อนรัน script นี้!
-- 2. Script นี้ใช้ SHOW CREATE TABLE แทน information_schema
-- 3. ใช้กับฐานข้อมูล: goodapp_clinic

USE goodapp_clinic;

-- ============================================
-- Step 1: ตรวจสอบ Foreign Key ที่จะลบ
-- ============================================

-- ดูโครงสร้างของ TREATMENT1_DIAGNOSIS เพื่อหาชื่อ Foreign Key
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- จากผลลัพธ์ด้านบน ให้หาบรรทัดที่มี "CONSTRAINT" และ "FOREIGN KEY"
-- ตัวอย่าง: CONSTRAINT `treatment1_diagnosis_ibfk_1` FOREIGN KEY (`VNO`) REFERENCES `TREATMENT1` (`VNO`)
-- ชื่อ constraint คือ: treatment1_diagnosis_ibfk_1

-- ============================================
-- Step 2: ลบ Foreign Key จาก TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ แก้ไขชื่อ constraint ให้ตรงกับผลลัพธ์จาก Step 1
-- ตัวอย่าง: ถ้าชื่อ constraint คือ 'treatment1_diagnosis_ibfk_1'
ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY treatment1_diagnosis_ibfk_1;

-- ถ้าไม่รู้ชื่อ constraint ให้ลองชื่อเหล่านี้:
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY treatment1_diagnosis_ibfk_1;
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY TREATMENT1_DIAGNOSIS_ibfk_1;
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY fk_vno;

-- ============================================
-- Step 3: ตรวจสอบว่า Foreign Key ถูกลบแล้ว
-- ============================================

SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- ถ้าไม่มี Foreign Key แล้ว จะไม่เห็น "CONSTRAINT ... FOREIGN KEY" ในผลลัพธ์

-- ============================================
-- Step 4: ตรวจสอบ Primary Key ของ TREATMENT1
-- ============================================

SHOW CREATE TABLE TREATMENT1;

-- ดูผลลัพธ์ว่ามี "PRIMARY KEY (`VNO`)" หรือไม่

-- ============================================
-- Step 5: ตรวจสอบว่ามีข้อมูลซ้ำหรือไม่
-- ============================================

SELECT VNO, COUNT(*) as count
FROM TREATMENT1
GROUP BY VNO
HAVING COUNT(*) > 1;

-- ถ้ามีผลลัพธ์ = มีข้อมูลซ้ำ ไม่ควรลบ Primary Key
-- ถ้าไม่มีผลลัพธ์ = ไม่มีข้อมูลซ้ำ สามารถลบ Primary Key ได้

-- ============================================
-- Step 6: ลบ Primary Key จาก TREATMENT1 (ถ้าจำเป็น)
-- ============================================

-- ⚠️ ระวัง: การลบ Primary Key อาจทำให้ข้อมูลซ้ำกันได้
-- รันเฉพาะเมื่อแน่ใจว่าไม่มีข้อมูลซ้ำ (จาก Step 5)

ALTER TABLE TREATMENT1 DROP PRIMARY KEY;

-- ============================================
-- Step 7: ตรวจสอบผลลัพธ์
-- ============================================

SHOW CREATE TABLE TREATMENT1;
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- ============================================
-- Step 8: ตรวจสอบ Indexes
-- ============================================

SHOW INDEXES FROM TREATMENT1 WHERE Key_name = 'PRIMARY';
SHOW INDEXES FROM TREATMENT1_DIAGNOSIS;

SELECT '=== Done! FK/PK removed ===' as result;



