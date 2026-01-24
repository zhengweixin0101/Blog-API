const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../../db.js');
const turnstile = require('../../middleware/turnstile');
const { asyncHandler } = require('../../middleware/errorHandler');
const { Auth } = require('../../utils/config');

const router = express.Router();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * 清理过期的 token
 */
async function cleanupExpiredTokens() {
    const result = await db.query(
        `DELETE FROM tokens
         WHERE expires_at IS NOT NULL AND expires_at < NOW()
         RETURNING id`
    );
    if (result.rows.length > 0) {
        console.log(`🧹 清理了 ${result.rows.length} 个过期的 token`);
    }
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

    // 清理过期的 token
    await cleanupExpiredTokens();

    // 从 configs 表获取管理员信息
    const result = await db.query(
        'SELECT value FROM configs WHERE key = $1',
        ['admin']
    );

    if (result.rows.length === 0) {
        // 首次使用，创建管理员配置
        const hash = await bcrypt.hash(password, 10);
        const token = generateToken();
        const tokenExpiresAt = new Date(Date.now() + Auth.TOKEN_EXPIRY);

        const adminConfig = {
            username,
            password: hash
        };

        await db.query(
            `INSERT INTO configs (key, value, description) VALUES ($1, $2, $3)`,
            ['admin', JSON.stringify(adminConfig), '管理员账号配置']
        );

        // 创建 token 记录
        await db.query(
            `INSERT INTO tokens (token, name, description, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [token, 'Login', '登录时自动创建', tokenExpiresAt]
        );

        // 创建账号成功，清除人机验证标记
        turnstile.clearVerification();
        return res.json({
            success: true,
            message: '账号创建成功',
            token,
            expiresIn: Auth.TOKEN_EXPIRY
        });
    }

    const adminConfig = result.rows[0].value;
    const isValid = await bcrypt.compare(password, adminConfig.password);

    if (!isValid) {
        // 密码错误，要求后续请求进行人机验证
        turnstile.setNeedVerification(true);
        const err = new Error('用户名或密码错误');
        err.status = 401;
        throw err;
    }

    // 验证用户名
    if (adminConfig.username !== username) {
        turnstile.setNeedVerification(true);
        const err = new Error('用户名或密码错误');
        err.status = 401;
        throw err;
    }

    const token = generateToken();
    const tokenExpiresAt = new Date(Date.now() + Auth.TOKEN_EXPIRY);

    // 创建新的 token 记录
    await db.query(
        `INSERT INTO tokens (token, name, description, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [token, 'Login', '登录时自动创建', tokenExpiresAt]
    );

    // 登录成功，清除人机验证标记
    turnstile.clearVerification();
    res.json({
        success: true,
        message: '登录成功',
        token,
        expiresIn: Auth.TOKEN_EXPIRY
    });
}));

module.exports = router;