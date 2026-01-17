const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../../db.js');
const turnstile = require('../../middleware/turnstile');

const router = express.Router();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

router.post('/', async (req, res) => {
    try {
        const { username, password, turnstileToken } = req.body;
        const providedToken = turnstileToken || req.headers['x-turnstile-token'];

        // 若服务端已标记需要人机验证，且本次请求未提供 turnstile token，则直接返回提示
        if (turnstile.shouldRequireVerification(providedToken)) {
            return res.status(400).json({ error: '请先进行人机验证', needTurnstile: true });
        }

        const result = await db.query(
            'SELECT * FROM admin WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            const adminCountResult = await db.query('SELECT COUNT(*) FROM admin');
            const adminCount = parseInt(adminCountResult.rows[0].count, 10);

            if (adminCount > 0) {
                turnstile.setNeedVerification(true);
                return res.status(403).json({ error: '用户名或密码错误' });
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
            turnstile.clearVerification();
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
            turnstile.setNeedVerification(true);
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
        turnstile.clearVerification();
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