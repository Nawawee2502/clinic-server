ALTER TABLE TREATMENT1 ADD COLUMN UCS_STATUS VARCHAR(50) DEFAULT 'unpaid';
-- Optional: Initialize existing data based on assumption or leave as 'unpaid'
-- UPDATE TREATMENT1 SET UCS_STATUS = 'unpaid' WHERE UCS_CARD = 'Y';
