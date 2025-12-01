-- เพิ่ม field TREATMENT_FEE ใน TREATMENT1 table สำหรับเก็บค่ารักษาแยก
-- ใช้ DECIMAL(10,2) เพื่อรองรับค่ารักษาเป็นตัวเลขทศนิยม

ALTER TABLE TREATMENT1 
ADD COLUMN TREATMENT_FEE DECIMAL(10,2) DEFAULT 100.00 COMMENT 'ค่ารักษา (แยกจาก TOTAL_AMOUNT)';

-- อัพเดตข้อมูลเดิม: ถ้า TREATMENT_FEE เป็น NULL ให้ตั้งค่าเป็น 100.00
UPDATE TREATMENT1 
SET TREATMENT_FEE = 100.00 
WHERE TREATMENT_FEE IS NULL;

