const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../../db.js');
const turnstile = require('../../middleware/turnstile');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/system/login - 管理员登录/注册（使用首次登录的账号密码自动注册）
 * Body: { username, password, turnstileToken? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { username, password, turnstileToken } = req.body;
    const providedToken = turnstileToken || req.headers['x-turnstile-token'];

    // 若服务端已标记需要人机验证，且本次请求未提供 turnstile token，则直接返回提示
    if (turnstile.shouldRequireVerification(providedToken)) {
        return res.status(400).json({
            success: false,
            error: '请先进行人机验证',
            needTurnstile: true
        });
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
            const err = new Error('用户名或密码错误');
            err.status = 403;
            throw err;
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
            success: true,
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
        const err = new Error('用户名或密码错误');
        err.status = 401;
        throw err;
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
        success: true,
        message: '登录成功',
        token,
        expiresIn: TOKEN_EXPIRY
    });
}));

module.exports = router;