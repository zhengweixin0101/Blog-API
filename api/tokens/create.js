const express = require('express');
const crypto = require('crypto');
const db = require('../../db.js');
const { asyncHandler } = require('../../middleware/errorHandler');
const { Auth } = require('../../utils/config');
const { CacheKeys } = require('../../utils/constants');
const redis = db.redis;

const router = express.Router();

function generateToken() {
    return crypto.randomBytes(Auth.TOKEN_LENGTH / 2).toString('hex');
}

/**
 * POST /api/tokens/create - 创建新 token
 * Body: { name, description?, expiresIn?, permissions }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { name, description, expiresIn, permissions } = req.body;

    const token = generateToken();
    const tokenExpiresAt = new Date(Date.now() + expiresIn);

    // 将 token 写入 Redis
    const now = new Date();
    const tokenData = {
        id: Date.now(),
        token: token,
        name: name,
        description: description || null,
        expires_at: tokenExpiresAt.toISOString(),
        created_at: now.toISOString(),
        last_used_at: now.toISOString(),
        permissions: permissions
    };

    // 计算缓存 TTL（至少 60 秒）
    const ttlSeconds = Math.max(
        60,
        Math.floor((tokenExpiresAt - new Date()) / 1000)
    );
    await redis.set(CacheKeys.tokenKey(token), JSON.stringify(tokenData), 'EX', ttlSeconds);

    res.json({
        success: true,
        message: 'Token 创建成功',
        data: {
            id: tokenData.id,
            name: tokenData.name,
            description: tokenData.description,
            token: token, // 只在创建时返回完整 token
            expiresAt: tokenData.expires_at,
            createdAt: tokenData.created_at,
            expiresIn,
            permissions
        }
    });
}));

module.exports = router;
