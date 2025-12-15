-- ============================================
-- ลบ Foreign Key และ Primary Key (ลำดับที่ถูกต้อง)
-- สำหรับ TREATMENT1 และ TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ หมายเหตุสำคัญ:
-- 1. Backup ฐานข้อมูลก่อนรัน script นี้!
-- 2. ต้องลบ Foreign Key ก่อน แล้วค่อยลบ Primary Key
-- 3. รันทีละคำสั่ง ตรวจสอบผลลัพธ์ก่อนรันคำสั่งถัดไป

USE goodapp_clinic;

-- ============================================
-- Step 1: ดูโครงสร้าง TREATMENT1_DIAGNOSIS เพื่อหาชื่อ Foreign Key
-- ============================================

SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

-- จากผลลัพธ์ ให้หาบรรทัดที่มี "CONSTRAINT" และ "FOREIGN KEY"
-- ตัวอย่าง: CONSTRAINT `treatment1_diagnosis_ibfk_1` FOREIGN KEY (`VNO`) REFERENCES `TREATMENT1` (`VNO`)
-- ชื่อ constraint คือ: treatment1_diagnosis_ibfk_1

-- ============================================
-- Step 2: ตรวจสอบ Foreign Key อื่นๆ ที่อ้างอิง TREATMENT1
-- ============================================

-- ตรวจสอบตารางอื่นๆ ที่อาจมี Foreign Key อ้างอิง TREATMENT1
SHOW CREATE TABLE TREATMENT1_DRUG;
SHOW CREATE TABLE TREATMENT1_MED_PROCEDURE;
SHOW CREATE TABLE TREATMENT1_LABORATORY;
SHOW CREATE TABLE TREATMENT1_RADIOLOGICAL;

-- ดูผลลัพธ์จากแต่ละตารางว่ามี Foreign Key อ้างอิง TREATMENT1 หรือไม่

-- ============================================
-- Step 3: ลบ Foreign Key จาก TREATMENT1_DIAGNOSIS
-- ============================================

-- ⚠️ แก้ไขชื่อ constraint ให้ตรงกับผลลัพธ์จาก Step 1
-- ลบ comment (--) ออกแล้วรัน

ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY treatment1_diagnosis_ibfk_1;

-- ถ้า error ให้ลองชื่อเหล่านี้ทีละอัน:
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY TREATMENT1_DIAGNOSIS_ibfk_1;
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY fk_vno;
-- ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY TREATMENT1_DIAGNOSIS_ibfk1;

-- ============================================
-- Step 4: ลบ Foreign Key จากตารางอื่นๆ (ถ้ามี)
-- ============================================

-- ลบ Foreign Key จาก TREATMENT1_DRUG (ถ้ามี)
-- ALTER TABLE TREATMENT1_DRUG DROP FOREIGN KEY treatment1_drug_ibfk_1;

-- ลบ Foreign Key จาก TREATMENT1_MED_PROCEDURE (ถ้ามี)
-- ALTER TABLE TREATMENT1_MED_PROCEDURE DROP FOREIGN KEY treatment1_med_procedure_ibfk_1;

-- ลบ Foreign Key จาก TREATMENT1_LABORATORY (ถ้ามี)
-- ALTER TABLE TREATMENT1_LABORATORY DROP FOREIGN KEY treatment1_laboratory_ibfk_1;

-- ลบ Foreign Key จาก TREATMENT1_RADIOLOGICAL (ถ้ามี)
-- ALTER TABLE TREATMENT1_RADIOLOGICAL DROP FOREIGN KEY treatment1_radiological_ibfk_1;

-- ============================================
-- Step 5: ตรวจสอบว่า Foreign Key ถูกลบแล้วทั้งหมด
-- ============================================

SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;
SHOW CREATE TABLE TREATMENT1_DRUG;
SHOW CREATE TABLE TREATMENT1_MED_PROCEDURE;
SHOW CREATE TABLE TREATMENT1_LABORATORY;
SHOW CREATE TABLE TREATMENT1_RADIOLOGICAL;

-- ถ้าไม่มี Foreign Key แล้ว จะไม่เห็น "CONSTRAINT ... FOREIGN KEY" ในผลลัพธ์

-- ============================================
-- Step 6: ตรวจสอบ Primary Key ของ TREATMENT1
-- ============================================

SHOW CREATE TABLE TREATMENT1;

-- ดูผลลัพธ์ว่ามี "PRIMARY KEY (`VNO`)" หรือไม่

-- ============================================
-- Step 7: ตรวจสอบว่ามีข้อมูลซ้ำหรือไม่
-- ============================================

SELECT VNO, COUNT(*) as count
FROM TREATMENT1
GROUP BY VNO
HAVING COUNT(*) > 1;

-- ถ้ามีผลลัพธ์ = มีข้อมูลซ้ำ ไม่ควรลบ Primary Key
-- ถ้าไม่มีผลลัพธ์ = ไม่มีข้อมูลซ้ำ สามารถลบ Primary Key ได้

-- ============================================
-- Step 8: ลบ Primary Key จาก TREATMENT1 (หลังจากลบ Foreign Key แล้ว)
-- ============================================

-- ⚠️ ระวัง: การลบ Primary Key อาจทำให้ข้อมูลซ้ำกันได้
-- รันเฉพาะเมื่อแน่ใจว่า:
-- 1. ไม่มี Foreign Key อ้างอิง TREATMENT1.VNO แล้ว (จาก Step 5)
-- 2. ไม่มีข้อมูลซ้ำ (จาก Step 7)

ALTER TABLE TREATMENT1 DROP PRIMARY KEY;

-- ============================================
-- Step 9: ตรวจสอบผลลัพธ์
-- ============================================

SHOW CREATE TABLE TREATMENT1;
SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;

SELECT '=== Done! FK/PK removed ===' as result;



