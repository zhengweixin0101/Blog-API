const express = require('express');
const db = require('../../db.js');
const verifyAuth = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { CacheKeys } = require('../../utils/constants');
const redis = db.redis;

const router = express.Router();

/**
 * GET /api/tokens/list - 获取所有 token 列表
 */
router.get('/', verifyAuth, asyncHandler(async (req, res) => {
    // 从 Redis 扫描所有 token
    const tokens = [];
    let cursor = '0';

    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', CacheKeys.TOKENS_PATTERN, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
            const values = await redis.mget(keys);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
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
                            // 隐藏完整 token，只显示前 8 位
                            tokenPreview: tokenData.token ? `${tokenData.token.substring(0, 8)}...` : null
                        });
                    } catch (err) {
                        // 忽略解析错误，删除无效数据
                        await redis.del(key);
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

module.exports = router;
