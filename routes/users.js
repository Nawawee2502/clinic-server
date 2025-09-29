const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Middleware สำหรับตรวจสอบ Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'ไม่พบ Token กรุณา Login'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token หมดอายุหรือไม่ถูกต้อง',
                expired: true
            });
        }
        req.user = user;
        next();
    });
};

// Middleware สำหรับตรวจสอบ Role Admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็น Admin)'
        });
    }
    next();
};

// ============================================
// POST /api/users/register - ลงทะเบียน (Public)
// ============================================
router.post('/register', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { username, password, fullName, empCode, email, tel } = req.body;

        // Validation
        if (!username || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน (Username, Password, Full Name)'
            });
        }

        // ตรวจสอบความยาว Password
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password ต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
            });
        }

        // ตรวจสอบ Username ซ้ำ
        const [existing] = await db.execute(
            'SELECT USER_ID FROM USERS WHERE USERNAME = ?',
            [username]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Username นี้มีอยู่ในระบบแล้ว'
            });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert User (Role เป็น 'user' ตามค่าเริ่มต้น)
        const [result] = await db.execute(`
            INSERT INTO USERS 
            (USERNAME, PASSWORD, FULL_NAME, ROLE, EMP_CODE, EMAIL, TEL, STATUS, CREATED_DATE)
            VALUES (?, ?, ?, 'user', ?, ?, ?, 'active', NOW())
        `, [username, hashedPassword, fullName, empCode, email, tel]);

        // สร้าง JWT Token ทันที
        const token = jwt.sign(
            {
                userId: result.insertId,
                username: username,
                role: 'user',
                empCode: empCode
            },
            process.env.JWT_SECRET || 'your-secret-key-change-this',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'ลงทะเบียนสำเร็จ',
            data: {
                token,
                user: {
                    userId: result.insertId,
                    username,
                    fullName,
                    role: 'user',
                    empCode,
                    email
                }
            }
        });

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลงทะเบียน',
            error: error.message
        });
    }
});

// ============================================
// POST /api/users/login - เข้าสู่ระบบ
// ============================================
router.post('/login', async (req, res) => {
    try {
        const db = await require('../config/db');
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอก Username และ Password'
            });
        }

        // ค้นหา User
        const [users] = await db.execute(
            'SELECT * FROM USERS WHERE USERNAME = ? AND STATUS = "active"',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Username หรือ Password ไม่ถูกต้อง'
            });
        }

        const user = users[0];

        // ตรวจสอบ Password
        const isPasswordValid = await bcrypt.compare(password, user.PASSWORD);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Username หรือ Password ไม่ถูกต้อง'
            });
        }

        // สร้าง JWT Token (อายุ 24 ชั่วโมง)
        const token = jwt.sign(
            {
                userId: user.USER_ID,
                username: user.USERNAME,
                role: user.ROLE,
                empCode: user.EMP_CODE
            },
            process.env.JWT_SECRET || 'your-secret-key-change-this',
            { expiresIn: '24h' }
        );

        // อัปเดต Last Login
        await db.execute(
            'UPDATE USERS SET LAST_LOGIN = NOW() WHERE USER_ID = ?',
            [user.USER_ID]
        );

        res.json({
            success: true,
            message: 'เข้าสู่ระบบสำเร็จ',
            data: {
                token,
                user: {
                    userId: user.USER_ID,
                    username: user.USERNAME,
                    fullName: user.FULL_NAME,
                    role: user.ROLE,
                    empCode: user.EMP_CODE,
                    email: user.EMAIL
                }
            }
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
            error: error.message
        });
    }
});

// ============================================
// POST /api/users/verify-token - ตรวจสอบ Token
// ============================================
router.post('/verify-token', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');

        const [users] = await db.execute(
            'SELECT USER_ID, USERNAME, FULL_NAME, ROLE, EMP_CODE, EMAIL FROM USERS WHERE USER_ID = ? AND STATUS = "active"',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User ไม่พบหรือถูกระงับ',
                expired: true
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    userId: users[0].USER_ID,
                    username: users[0].USERNAME,
                    fullName: users[0].FULL_NAME,
                    role: users[0].ROLE,
                    empCode: users[0].EMP_CODE,
                    email: users[0].EMAIL
                }
            }
        });

    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบ Token',
            error: error.message
        });
    }
});

// ============================================
// GET /api/users - ดึงรายการ User ทั้งหมด (Admin Only)
// ============================================
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { page = 1, limit = 20, status, role, search } = req.query;

        const limitInt = parseInt(limit);
        const pageInt = parseInt(page);
        const offset = (pageInt - 1) * limitInt;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (status) {
            whereClause += ' AND STATUS = ?';
            params.push(status);
        }
        if (role) {
            whereClause += ' AND ROLE = ?';
            params.push(role);
        }
        if (search) {
            whereClause += ' AND (USERNAME LIKE ? OR FULL_NAME LIKE ? OR EMAIL LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const [rows] = await db.execute(`
            SELECT 
                USER_ID, USERNAME, FULL_NAME, ROLE, EMP_CODE, 
                EMAIL, TEL, STATUS, CREATED_DATE, LAST_LOGIN
            FROM USERS
            ${whereClause}
            ORDER BY CREATED_DATE DESC
            LIMIT ? OFFSET ?
        `, [...params, limitInt, offset]);

        const [countResult] = await db.execute(`
            SELECT COUNT(*) as total FROM USERS ${whereClause}
        `, params);

        res.json({
            success: true,
            data: rows,
            pagination: {
                page: pageInt,
                limit: limitInt,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limitInt)
            }
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล User',
            error: error.message
        });
    }
});

// ============================================
// GET /api/users/:id - ดึงข้อมูล User ตาม ID
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { id } = req.params;

        // ตรวจสอบสิทธิ์: Admin หรือ User ตัวเอง
        if (req.user.role !== 'admin' && req.user.userId !== parseInt(id)) {
            return res.status(403).json({
                success: false,
                message: 'ไม่มีสิทธิ์เข้าถึงข้อมูล User นี้'
            });
        }

        const [users] = await db.execute(`
            SELECT 
                USER_ID, USERNAME, FULL_NAME, ROLE, EMP_CODE, 
                EMAIL, TEL, STATUS, CREATED_DATE, LAST_LOGIN
            FROM USERS
            WHERE USER_ID = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบ User'
            });
        }

        res.json({
            success: true,
            data: users[0]
        });

    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล User',
            error: error.message
        });
    }
});

// ============================================
// POST /api/users - สร้าง User ใหม่ (Admin Only)
// ============================================
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { username, password, fullName, role, empCode, email, tel } = req.body;

        // Validation
        if (!username || !password || !fullName || !role) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน (Username, Password, Full Name, Role)'
            });
        }

        // ตรวจสอบ Username ซ้ำ
        const [existing] = await db.execute(
            'SELECT USER_ID FROM USERS WHERE USERNAME = ?',
            [username]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Username นี้มีอยู่ในระบบแล้ว'
            });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert User
        const [result] = await db.execute(`
            INSERT INTO USERS 
            (USERNAME, PASSWORD, FULL_NAME, ROLE, EMP_CODE, EMAIL, TEL, STATUS, CREATED_DATE)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        `, [username, hashedPassword, fullName, role, empCode, email, tel]);

        res.status(201).json({
            success: true,
            message: 'สร้าง User สำเร็จ',
            data: {
                userId: result.insertId,
                username,
                fullName,
                role
            }
        });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้าง User',
            error: error.message
        });
    }
});

// ============================================
// PUT /api/users/:id - แก้ไขข้อมูล User
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { id } = req.params;
        const { fullName, email, tel, password, role, status } = req.body;

        // ตรวจสอบสิทธิ์
        const isAdmin = req.user.role === 'admin';
        const isOwnProfile = req.user.userId === parseInt(id);

        if (!isAdmin && !isOwnProfile) {
            return res.status(403).json({
                success: false,
                message: 'ไม่มีสิทธิ์แก้ไข User นี้'
            });
        }

        // สร้าง dynamic update query
        const updates = [];
        const params = [];

        if (fullName !== undefined) {
            updates.push('FULL_NAME = ?');
            params.push(fullName);
        }
        if (email !== undefined) {
            updates.push('EMAIL = ?');
            params.push(email);
        }
        if (tel !== undefined) {
            updates.push('TEL = ?');
            params.push(tel);
        }

        // เฉพาะ Admin ถึงจะเปลี่ยน Role และ Status ได้
        if (isAdmin) {
            if (role !== undefined) {
                updates.push('ROLE = ?');
                params.push(role);
            }
            if (status !== undefined) {
                updates.push('STATUS = ?');
                params.push(status);
            }
        }

        // เปลี่ยน Password (ต้อง Hash ใหม่)
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('PASSWORD = ?');
            params.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'ไม่มีข้อมูลที่ต้องการอัปเดต'
            });
        }

        params.push(id);

        const [result] = await db.execute(`
            UPDATE USERS SET ${updates.join(', ')} WHERE USER_ID = ?
        `, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบ User'
            });
        }

        res.json({
            success: true,
            message: 'อัปเดต User สำเร็จ',
            data: { userId: id }
        });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดต User',
            error: error.message
        });
    }
});

// ============================================
// DELETE /api/users/:id - ลบ User (Admin Only)
// ============================================
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { id } = req.params;

        // ห้ามลบตัวเอง
        if (req.user.userId === parseInt(id)) {
            return res.status(400).json({
                success: false,
                message: 'ไม่สามารถลบ User ของตัวเองได้'
            });
        }

        const [result] = await db.execute(
            'DELETE FROM USERS WHERE USER_ID = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบ User'
            });
        }

        res.json({
            success: true,
            message: 'ลบ User สำเร็จ'
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบ User',
            error: error.message
        });
    }
});

// ============================================
// POST /api/users/change-password - เปลี่ยน Password
// ============================================
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const db = await require('../config/db');
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอก Password เก่าและใหม่'
            });
        }

        // ดึง Password เดิม
        const [users] = await db.execute(
            'SELECT PASSWORD FROM USERS WHERE USER_ID = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบ User'
            });
        }

        // ตรวจสอบ Password เก่า
        const isValid = await bcrypt.compare(oldPassword, users[0].PASSWORD);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Password เก่าไม่ถูกต้อง'
            });
        }

        // Hash Password ใหม่
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.execute(
            'UPDATE USERS SET PASSWORD = ? WHERE USER_ID = ?',
            [hashedPassword, req.user.userId]
        );

        res.json({
            success: true,
            message: 'เปลี่ยน Password สำเร็จ'
        });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเปลี่ยน Password',
            error: error.message
        });
    }
});

// Export middleware สำหรับใช้ใน routes อื่นๆ
module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;