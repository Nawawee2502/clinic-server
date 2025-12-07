# คำแนะนำการลบ Foreign Key และ Primary Key

## ⚠️ สำคัญ: Backup ฐานข้อมูลก่อน!

## วิธีที่ 1: ลบอัตโนมัติ (แนะนำ)

1. Backup ฐานข้อมูลก่อน
2. เปิดไฟล์ `REMOVE_FK_PK_NOW.sql`
3. รันทั้งไฟล์ใน MySQL (phpMyAdmin, MySQL Workbench, หรือ command line)
4. ตรวจสอบผลลัพธ์

## วิธีที่ 2: ลบทีละขั้นตอน (ปลอดภัยกว่า)

1. Backup ฐานข้อมูลก่อน
2. เปิดไฟล์ `remove_fk_pk_step_by_step.sql`
3. รันทีละคำสั่ง ตรวจสอบผลลัพธ์ก่อนรันคำสั่งถัดไป

## วิธีที่ 3: ลบเฉพาะ Foreign Key (ไม่ลบ Primary Key)

1. Backup ฐานข้อมูลก่อน
2. เปิดไฟล์ `remove_fk_pk_treatment_only.sql`
3. Uncomment บรรทัดที่ต้องการรัน

## หลังจากลบแล้ว

1. ทดสอบระบบว่าทำงานได้หรือไม่
2. ถ้าทำงานได้แล้ว แก้ไขปัญหา (เช่น Collation)
3. สร้าง FK/PK กลับมาด้วย script `add_treatment1_primary_key.sql` และสร้าง FK ใหม่

## สร้าง FK/PK กลับมา

```sql
-- สร้าง Primary Key กลับมา
ALTER TABLE TREATMENT1 ADD PRIMARY KEY (VNO);

-- สร้าง Foreign Key กลับมา
ALTER TABLE TREATMENT1_DIAGNOSIS 
ADD CONSTRAINT treatment1_diagnosis_ibfk_1 
FOREIGN KEY (VNO) REFERENCES TREATMENT1(VNO) 
ON DELETE CASCADE ON UPDATE CASCADE;
```


