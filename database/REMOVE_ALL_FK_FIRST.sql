-- ============================================
-- ลบ Foreign Key ทั้งหมดที่อ้างอิง TREATMENT1 ก่อน
-- แล้วค่อยลบ Primary Key
-- ============================================

-- ⚠️ หมายเหตุสำคัญ:
-- 1. Backup ฐานข้อมูลก่อนรัน script นี้!
-- 2. ต้องลบ Foreign Key ทั้งหมดก่อน แล้วค่อยลบ Primary Key
-- 3. รันทีละคำสั่ง ตรวจสอบผลลัพธ์ก่อนรันคำสั่งถัดไป

USE goodapp_clinic;

-- ============================================
-- Step 1: ดูโครงสร้างตารางทั้งหมดที่อาจมี Foreign Key
-- ============================================

SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;
SHOW CREATE TABLE TREATMENT1_DRUG;
SHOW CREATE TABLE TREATMENT1_MED_PROCEDURE;
SHOW CREATE TABLE TREATMENT1_LABORATORY;
SHOW CREATE TABLE TREATMENT1_RADIOLOGICAL;

-- จากผลลัพธ์ ให้หาบรรทัดที่มี "CONSTRAINT" และ "FOREIGN KEY" ที่อ้างอิง TREATMENT1
-- ตัวอย่าง: CONSTRAINT `treatment1_diagnosis_ibfk_1` FOREIGN KEY (`VNO`) REFERENCES `TREATMENT1` (`VNO`)

-- ============================================
-- Step 2: ลบ Foreign Key จากทุกตารางที่อ้างอิง TREATMENT1
-- ============================================

-- ⚠️ แก้ไขชื่อ constraint ให้ตรงกับผลลัพธ์จาก Step 1
-- ลบ comment (--) ออกแล้วรันทีละคำสั่ง

-- ลบ Foreign Key จาก TREATMENT1_DIAGNOSIS
ALTER TABLE TREATMENT1_DIAGNOSIS DROP FOREIGN KEY treatment1_diagnosis_ibfk_1;

-- ลบ Foreign Key จาก TREATMENT1_DRUG (ถ้ามี)
-- ALTER TABLE TREATMENT1_DRUG DROP FOREIGN KEY treatment1_drug_ibfk_1;

-- ลบ Foreign Key จาก TREATMENT1_MED_PROCEDURE (ถ้ามี)
-- ALTER TABLE TREATMENT1_MED_PROCEDURE DROP FOREIGN KEY treatment1_med_procedure_ibfk_1;

-- ลบ Foreign Key จาก TREATMENT1_LABORATORY (ถ้ามี)
-- ALTER TABLE TREATMENT1_LABORATORY DROP FOREIGN KEY treatment1_laboratory_ibfk_1;

-- ลบ Foreign Key จาก TREATMENT1_RADIOLOGICAL (ถ้ามี)
-- ALTER TABLE TREATMENT1_RADIOLOGICAL DROP FOREIGN KEY treatment1_radiological_ibfk_1;

-- ============================================
-- Step 3: ตรวจสอบว่า Foreign Key ถูกลบแล้วทั้งหมด
-- ============================================

SHOW CREATE TABLE TREATMENT1_DIAGNOSIS;
SHOW CREATE TABLE TREATMENT1_DRUG;
SHOW CREATE TABLE TREATMENT1_MED_PROCEDURE;
SHOW CREATE TABLE TREATMENT1_LABORATORY;
SHOW CREATE TABLE TREATMENT1_RADIOLOGICAL;

-- ถ้าไม่มี Foreign Key แล้ว จะไม่เห็น "CONSTRAINT ... FOREIGN KEY" ในผลลัพธ์

-- ============================================
-- Step 4: ตรวจสอบว่ามีข้อมูลซ้ำหรือไม่
-- ============================================

SELECT VNO, COUNT(*) as count
FROM TREATMENT1
GROUP BY VNO
HAVING COUNT(*) > 1;

-- ถ้ามีผลลัพธ์ = มีข้อมูลซ้ำ ไม่ควรลบ Primary Key
-- ถ้าไม่มีผลลัพธ์ = ไม่มีข้อมูลซ้ำ สามารถลบ Primary Key ได้

-- ============================================
-- Step 5: ลบ Primary Key จาก TREATMENT1 (หลังจากลบ Foreign Key แล้ว)
-- ============================================

-- ⚠️ รันเฉพาะเมื่อแน่ใจว่า:
-- 1. ไม่มี Foreign Key อ้างอิง TREATMENT1.VNO แล้ว (จาก Step 3)
-- 2. ไม่มีข้อมูลซ้ำ (จาก Step 4)

ALTER TABLE TREATMENT1 DROP PRIMARY KEY;

-- ============================================
-- Step 6: ตรวจสอบผลลัพธ์
-- ============================================

SHOW CREATE TABLE TREATMENT1;

SELECT '=== Done! All FK removed, Primary Key removed ===' as result;



