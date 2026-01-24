const express = require('express');
const db = require('../../db.js');
const verifyAuth = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { deleteTokenSchema, validate } = require('../../middleware/validate');
const { CacheKeys } = require('../../utils/constants');
const redis = db.redis;

const router = express.Router();

/**
 * DELETE /api/tokens/delete - 删除 token
 * Body: { id }
 */
router.delete('/', verifyAuth, validate(deleteTokenSchema), asyncHandler(async (req, res) => {
    const { id } = req.body;

    // 扫描所有 token 键，查找匹配 id 的 token
    let cursor = '0';
    let foundToken = null;
    let foundKey = null;

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
                        if (tokenData.id === Number(id)) {
                            foundToken = tokenData;
                            foundKey = key;
                            break;
                        }
                    } catch (err) {
                        // 忽略解析错误，删除无效数据
                        await redis.del(key);
                    }
                }
            }
        }
        if (foundToken) break;
    } while (cursor !== '0');

    if (!foundToken) {
        const err = new Error('Token 不存在');
        err.status = 404;
        throw err;
    }

    // 从 Redis 直接删除
    await redis.del(foundKey);

    res.json({
        success: true,
        message: `Token '${foundToken.name}' 已删除`
    });
}));

module.exports = router;
