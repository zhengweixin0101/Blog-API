const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../../db.js');
const turnstile = require('../../middleware/turnstile');
const { asyncHandler } = require('../../middleware/errorHandler');
const { Auth } = require('../../utils/config');
const { CacheKeys } = require('../../utils/constants');
const redis = db.redis;

const router = express.Router();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * 清理过期的 token
 */
async function cleanupExpiredTokens() {
    // 扫描所有 token 键
    let cursor = '0';
    let cleanedCount = 0;
    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', CacheKeys.TOKENS_PATTERN, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
            // 获取所有 token 数据
            const values = await redis.mget(keys);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const value = values[i];
                if (value) {
                    try {
                        const tokenData = JSON.parse(value);
                        // 检查是否过期
                        if (tokenData.expires_at !== null) {
                            const expiresAt = new Date(tokenData.expires_at);
                            if (expiresAt < new Date()) {
                                await redis.del(key);
                                cleanedCount++;
                            }
                        }
                    } catch (err) {
                        // 忽略解析错误，删除无效数据
                        await redis.del(key);
                    }
                }
            }
        }
    } while (cursor !== '0');

    if (cleanedCount > 0) {
        console.log(`🧹 清理了 ${cleanedCount} 个过期的 token`);
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

        // 将 token 写入 Redis
        const tokenData = {
            id: Date.now(),
            token: token,
            name: 'Login',
            description: '登录时自动创建',
            expires_at: tokenExpiresAt.toISOString(),
            created_at: new Date().toISOString(),
            last_used_at: new Date().toISOString()
        };
        await redis.set(CacheKeys.tokenKey(token), JSON.stringify(tokenData), 'EX', Auth.TOKEN_EXPIRY / 1000);

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

    // 将 token 写入 Redis
    const tokenData = {
        id: Date.now(),
        token: token,
        name: 'Login',
        description: '登录时自动创建',
        expires_at: tokenExpiresAt.toISOString(),
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString()
    };
    await redis.set(CacheKeys.tokenKey(token), JSON.stringify(tokenData), 'EX', Auth.TOKEN_EXPIRY / 1000);

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