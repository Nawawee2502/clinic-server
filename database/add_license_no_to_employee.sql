-- ============================================
-- Migration Script: Add LICENSE_NO to EMPLOYEE1
-- ============================================
-- วันที่: 2024-XX-XX
-- คำอธิบาย: เพิ่ม field LICENSE_NO (ใบอนุญาตประกอบวิชาชีพเวชกรรมเลขที่) 
--           ใน table EMPLOYEE1 สำหรับเก็บข้อมูลใบอนุญาตของแพทย์
-- ============================================

-- ✅ เพิ่ม field LICENSE_NO ใน table EMPLOYEE1
ALTER TABLE EMPLOYEE1 
ADD COLUMN LICENSE_NO VARCHAR(50) NULL 
COMMENT 'ใบอนุญาตประกอบวิชาชีพเวชกรรมเลขที่' 
AFTER EMP_TYPE;

-- ✅ ตรวจสอบผลลัพธ์
-- SELECT EMP_CODE, EMP_NAME, EMP_TYPE, LICENSE_NO FROM EMPLOYEE1 LIMIT 10;

