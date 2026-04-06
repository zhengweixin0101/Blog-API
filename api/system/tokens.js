const express = require('express');
const crypto = require('crypto');
const db = require('../../db.js');
const { asyncHandler } = require('../../middleware/errorHandler');
const { Auth } = require('../../utils/config');
const { CacheKeys } = require('../../utils/constants');
const logger = require('../../logger');

const redis = db.redis;

const router = express.Router();

function generateToken() {
    return crypto.randomBytes(Math.ceil(Auth.TOKEN_LENGTH / 2)).toString('hex');
}

/**
 * GET /api/system/tokens - 获取 token 列表
 */
router.get('/', asyncHandler(async (req, res) => {
    // 从 Redis 获取所有 tokens
    const tokens = [];
    let cursor = '0';

    do {
        const result = await redis.scan(cursor, 'MATCH', CacheKeys.TOKENS_PATTERN, 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
            const values = await redis.mget(keys);
            
            for (let i = 0; i < keys.length; i++) {
                const value = values[i];
                if (value) {
                    try {
                        const tokenData = JSON.parse(value);
                        tokens.push({
                            id: tokenData.id,
                            name: tokenData.name,
                            description: tokenData.description,
                            expiresAt: tokenData.expires_at,
                            createdAt: tokenData.created_at,
                            lastUsedAt: tokenData.last_used_at,
                            permissions: tokenData.permissions || [],
                            // 只显示 token 的前 8 位
                            tokenPreview: tokenData.token ? `${tokenData.token.substring(0, 8)}...` : null
                        });
                    } catch (err) {
                        // 忽略解析错误，删除无效数据
                        await redis.del(keys[i]);
                    }
                }
            }
        }
    } while (cursor !== '0');

    // 按创建时间倒序排序
    tokens.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
        success: true,
        message: '获取成功',
        data: tokens
    });
}));

/**
 * POST /api/system/tokens - 创建新 token
 * Body: { name, description?, expiresIn?, permissions? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { name, description, expiresIn, permissions } = req.body;

    const token = generateToken();
    const tokenExpiresAt = new Date(Date.now() + (expiresIn || 86400 * 1000)); // 默认24小时

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
        permissions: permissions || []
    };

    // 计算缓存 TTL（至少 60 秒）
    const ttlSeconds = Math.max(
        60,
        Math.floor((tokenExpiresAt.getTime() - now.getTime()) / 1000)
    );
    
    const tokenKey = `token:${tokenData.id}`;
    await redis.set(tokenKey, JSON.stringify(tokenData), 'EX', ttlSeconds);

    await logger.logFromRequest(req, `创建Token "${name}"`, 201);

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
            expiresIn: ttlSeconds,
            permissions: tokenData.permissions
        }
    });
}));

/**
 * DELETE /api/system/tokens - 删除 token
 * Body: { id }
 */
router.delete('/', asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        const err = new Error('缺少 token id');
        err.status = 400;
        throw err;
    }

    const tokenKey = `token:${id}`;
    const tokenData = await redis.get(tokenKey);

    if (!tokenData) {
        const err = new Error('Token 不存在');
        err.status = 404;
        throw err;
    }

    const parsedToken = JSON.parse(tokenData);
    await redis.del(tokenKey);

    await logger.logFromRequest(req, `删除Token "${parsedToken.name}"`, 200);

    res.json({
        success: true,
        message: `Token '${parsedToken.name}' 已删除`
    });
}));

module.exports = router;
