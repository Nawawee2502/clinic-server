const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('./users');

// ============================================
// GET /api/clinic-org - ดึงข้อมูลองค์กร
// ============================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');

        const [rows] = await db.execute(`
            SELECT 
                CLINIC_CODE,
                CLINIC_NAME,
                ADDR1,
                TUMBOL_CODE,
                AMPHER_CODE,
                PROVINCE_CODE,
                ZIPCODE,
                TEL1,
                logo1
            FROM clinic_org
            LIMIT 1
        `);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อมูลองค์กร'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('Error fetching clinic org:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลองค์กร',
            error: error.message
        });
    }
});

// ============================================
// PUT /api/clinic-org - อัปเดตข้อมูลองค์กร (Admin Only)
// ============================================
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const {
            clinicCode,
            clinicName,
            addr1,
            tumbolCode,
            ampherCode,
            provinceCode,
            zipcode,
            tel1,
            logo1
        } = req.body;

        // Validation
        if (!clinicName || !addr1) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกชื่อคลินิกและที่อยู่'
            });
        }

        // ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่
        const [existing] = await db.execute('SELECT CLINIC_CODE FROM clinic_org LIMIT 1');

        if (existing.length > 0) {
            // UPDATE
            const updates = [];
            const params = [];

            if (clinicName !== undefined) {
                updates.push('CLINIC_NAME = ?');
                params.push(clinicName);
            }
            if (addr1 !== undefined) {
                updates.push('ADDR1 = ?');
                params.push(addr1);
            }
            if (tumbolCode !== undefined) {
                updates.push('TUMBOL_CODE = ?');
                params.push(tumbolCode);
            }
            if (ampherCode !== undefined) {
                updates.push('AMPHER_CODE = ?');
                params.push(ampherCode);
            }
            if (provinceCode !== undefined) {
                updates.push('PROVINCE_CODE = ?');
                params.push(provinceCode);
            }
            if (zipcode !== undefined) {
                updates.push('ZIPCODE = ?');
                params.push(zipcode);
            }
            if (tel1 !== undefined) {
                updates.push('TEL1 = ?');
                params.push(tel1);
            }
            if (logo1 !== undefined) {
                updates.push('logo1 = ?');
                params.push(logo1);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'ไม่มีข้อมูลที่ต้องการอัปเดต'
                });
            }

            await db.execute(`
                UPDATE clinic_org SET ${updates.join(', ')} WHERE CLINIC_CODE = ?
            `, [...params, existing[0].CLINIC_CODE]);

            res.json({
                success: true,
                message: 'อัปเดตข้อมูลองค์กรสำเร็จ'
            });

        } else {
            // INSERT
            await db.execute(`
                INSERT INTO clinic_org 
                (CLINIC_CODE, CLINIC_NAME, ADDR1, TUMBOL_CODE, AMPHER_CODE, 
                 PROVINCE_CODE, ZIPCODE, TEL1, logo1)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                clinicCode || 'CLINIC001',
                clinicName,
                addr1,
                tumbolCode,
                ampherCode,
                provinceCode,
                zipcode,
                tel1,
                logo1
            ]);

            res.status(201).json({
                success: true,
                message: 'สร้างข้อมูลองค์กรสำเร็จ'
            });
        }

    } catch (error) {
        console.error('Error updating clinic org:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลองค์กร',
            error: error.message
        });
    }
});

// ============================================
// POST /api/clinic-org/logo - อัปโหลดโลโก้ (Admin Only)
// ============================================
router.post('/logo', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { logo } = req.body;

        if (!logo) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาส่งข้อมูลโลโก้'
            });
        }

        const db = await require('../config/db');

        // ตรวจสอบว่ามีข้อมูลองค์กรหรือไม่
        const [existing] = await db.execute('SELECT CLINIC_CODE FROM clinic_org LIMIT 1');

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'กรุณาสร้างข้อมูลองค์กรก่อน'
            });
        }

        await db.execute(
            'UPDATE clinic_org SET logo1 = ? WHERE CLINIC_CODE = ?',
            [logo, existing[0].CLINIC_CODE]
        );

        res.json({
            success: true,
            message: 'อัปโหลดโลโก้สำเร็จ'
        });

    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปโหลดโลโก้',
            error: error.message
        });
    }
});

module.exports = router;