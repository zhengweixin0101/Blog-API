const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../../db.js');
const turnstile = require('../../middleware/turnstile');

const router = express.Router();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

router.post('/', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 若服务端已标记需要人机验证，且本次请求未提供 turnstile token，则直接返回提示
        const providedToken = req.body.turnstileToken || req.headers['x-turnstile-token'];
        try {
            if (turnstile.isNeedVerification && turnstile.isNeedVerification() && !providedToken) {
                return res.status(400).json({ error: '请先进行人机验证', needTurnstile: true });
            }
        } catch (e) {
            // 忽略检查异常，继续正常流程
        }

        if (!username || !password) {
            // 缺少参数视为一次失败，要求后续请求进行人机验证
            try { turnstile.setNeedVerification(true); } catch (e) {}
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        const result = await db.query(
            'SELECT * FROM admin WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            const adminCountResult = await db.query('SELECT COUNT(*) FROM admin');
            const adminCount = parseInt(adminCountResult.rows[0].count, 10);

            if (adminCount > 0) {
                try { turnstile.setNeedVerification(true); } catch (e) {}
                return res.status(403).json({ error: '已存在管理员账号，无法创建新账号' });
            }

            const hash = await bcrypt.hash(password, 10);
            const token = generateToken();
            const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY);

            await db.query(
                `INSERT INTO admin (username, password, token, token_expires_at)
                 VALUES ($1, $2, $3, $4)`,
                [username, hash, token, tokenExpiresAt]
            );

            // 创建账号成功，清除人机验证标记
            try { turnstile.clearVerification(); } catch (e) {}
            return res.json({
                message: '账号创建成功并已登录',
                token,
                expiresIn: TOKEN_EXPIRY
            });
        }

        const admin = result.rows[0];
        const isValid = await bcrypt.compare(password, admin.password);

        if (!isValid) {
            // 密码错误，要求后续请求进行人机验证
            try { turnstile.setNeedVerification(true); } catch (e) {}
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = generateToken();
        const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY);

        await db.query(
            `UPDATE admin SET token = $1, token_expires_at = $2
             WHERE id = $3`,
            [token, tokenExpiresAt, admin.id]
        );

        // 登录成功，清除人机验证标记
        try { turnstile.clearVerification(); } catch (e) {}
        res.json({
            message: '登录成功',
            token,
            expiresIn: TOKEN_EXPIRY
        });
    } catch (err) {
        console.error('登录错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;