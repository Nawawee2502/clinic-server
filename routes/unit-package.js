const express = require('express');
const router = express.Router();

// ===============================================
// UNIT ROUTES (หน่วยนับ)
// ===============================================

// GET all units
router.get('/units', async (req, res) => {
    try {
        const db = await require('../config/db');
        console.log('🔍 Fetching units from database...');
        
        // ลอง query เพื่อดูว่ามี table หรือไม่
        const [rows] = await db.execute('SELECT * FROM TABLE_UNIT ORDER BY UNIT_NAME');
        console.log(`✅ Found ${rows.length} units`);

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('❌ Error fetching units:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            errno: error.errno
        });
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ',
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            sqlMessage: error.sqlMessage || null
        });
    }
});

// GET unit by code
router.get('/units/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM TABLE_UNIT WHERE UNIT_CODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลหน่วยนับ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching unit:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ',
            error: error.message
        });
    }
});

// POST create new unit
router.post('/units', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { UNIT_CODE, UNIT_NAME } = req.body;

        if (!UNIT_CODE || !UNIT_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อหน่วยนับ'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO TABLE_UNIT (UNIT_CODE, UNIT_NAME) VALUES (?, ?)',
            [UNIT_CODE, UNIT_NAME]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลหน่วยนับสำเร็จ',
            data: { UNIT_CODE, UNIT_NAME }
        });
    } catch (error) {
        console.error('Error creating unit:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสหน่วยนับนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลหน่วยนับ',
                error: error.message
            });
        }
    }
});

// PUT update unit
router.put('/units/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { UNIT_NAME } = req.body;

        const [result] = await db.execute(
            'UPDATE TABLE_UNIT SET UNIT_NAME = ? WHERE UNIT_CODE = ?',
            [UNIT_NAME, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลหน่วยนับที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลหน่วยนับสำเร็จ',
            data: { UNIT_CODE: code, UNIT_NAME }
        });
    } catch (error) {
        console.error('Error updating unit:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลหน่วยนับ',
            error: error.message
        });
    }
});

// DELETE unit
router.delete('/units/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM TABLE_UNIT WHERE UNIT_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลหน่วยนับที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลหน่วยนับสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting unit:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้หน่วยนับนี้ในข้อมูลอื่น'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลหน่วยนับ',
                error: error.message
            });
        }
    }
});

// ===============================================
// PACKAGE ROUTES (ขนาดบรรจุ)
// ===============================================

// GET all packages
router.get('/packages', async (req, res) => {
    try {
        const db = await require('../config/db');
        const [rows] = await db.execute('SELECT * FROM table_package ORDER BY PACKAGE_NAME');

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching packages:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลขนาดบรรจุ',
            error: error.message
        });
    }
});

// GET package by code
router.get('/packages/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const [rows] = await db.execute('SELECT * FROM table_package WHERE PACKAGE_CODE = ?', [code]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลขนาดบรรจุ'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching package:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลขนาดบรรจุ',
            error: error.message
        });
    }
});

// POST create new package
router.post('/packages', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { PACKAGE_CODE, PACKAGE_NAME } = req.body;

        if (!PACKAGE_CODE || !PACKAGE_NAME) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุรหัสและชื่อขนาดบรรจุ'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO table_package (PACKAGE_CODE, PACKAGE_NAME) VALUES (?, ?)',
            [PACKAGE_CODE, PACKAGE_NAME]
        );

        res.status(201).json({
            success: true,
            message: 'เพิ่มข้อมูลขนาดบรรจุสำเร็จ',
            data: { PACKAGE_CODE, PACKAGE_NAME }
        });
    } catch (error) {
        console.error('Error creating package:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({
                success: false,
                message: 'รหัสขนาดบรรจุนี้มีอยู่แล้ว'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลขนาดบรรจุ',
                error: error.message
            });
        }
    }
});

// PUT update package
router.put('/packages/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;
        const { PACKAGE_NAME } = req.body;

        const [result] = await db.execute(
            'UPDATE table_package SET PACKAGE_NAME = ? WHERE PACKAGE_CODE = ?',
            [PACKAGE_NAME, code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลขนาดบรรจุที่ต้องการแก้ไข'
            });
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลขนาดบรรจุสำเร็จ',
            data: { PACKAGE_CODE: code, PACKAGE_NAME }
        });
    } catch (error) {
        console.error('Error updating package:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลขนาดบรรจุ',
            error: error.message
        });
    }
});

// DELETE package
router.delete('/packages/:code', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { code } = req.params;

        const [result] = await db.execute('DELETE FROM table_package WHERE PACKAGE_CODE = ?', [code]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลขนาดบรรจุที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบข้อมูลขนาดบรรจุสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting package:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            res.status(409).json({
                success: false,
                message: 'ไม่สามารถลบได้เนื่องจากมีการใช้ขนาดบรรจุนี้ในข้อมูลยา'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูลขนาดบรรจุ',
                error: error.message
            });
        }
    }
});

// ===============================================
// COMBINED STATISTICS
// ===============================================

// GET combined statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const db = await require('../config/db');

        // Unit statistics
        const [unitCount] = await db.execute('SELECT COUNT(*) as total FROM TABLE_UNIT');

        // Package statistics
        const [packageCount] = await db.execute('SELECT COUNT(*) as total FROM table_package');

        // Most used units
        const [unitUsage] = await db.execute(`
            SELECT 
                u.UNIT_CODE,
                u.UNIT_NAME,
                COUNT(td.VNO) as drug_usage,
                COUNT(tmp.VNO) as procedure_usage,
                (COUNT(td.VNO) + COUNT(tmp.VNO)) as total_usage
            FROM TABLE_UNIT u
            LEFT JOIN TREATMENT1_DRUG td ON u.UNIT_CODE = td.UNIT_CODE
            LEFT JOIN TREATMENT1_MED_PROCEDURE tmp ON u.UNIT_CODE = tmp.UNIT_CODE
            GROUP BY u.UNIT_CODE, u.UNIT_NAME
            ORDER BY total_usage DESC
            LIMIT 10
        `);

        // Most used packages
        const [packageUsage] = await db.execute(`
            SELECT 
                p.PACKAGE_CODE,
                p.PACKAGE_NAME,
                COUNT(d.DRUG_CODE) as drug_count
            FROM table_package p
            LEFT JOIN table_drug d ON p.PACKAGE_CODE = d.PACKAGE_CODE
            GROUP BY p.PACKAGE_CODE, p.PACKAGE_NAME
            ORDER BY drug_count DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            data: {
                units: {
                    total: unitCount[0].total,
                    mostUsed: unitUsage
                },
                packages: {
                    total: packageCount[0].total,
                    mostUsed: packageUsage
                },
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching unit/package statistics:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงสถิติข้อมูลหน่วยนับและขนาดบรรจุ',
            error: error.message
        });
    }
});

module.exports = router;