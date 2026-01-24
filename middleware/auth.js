const db = require('../db.js');
const { asyncHandler } = require('./errorHandler');
const { CacheKeys } = require('../utils/constants');
const redis = db.redis;

async function verifyAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        const err = new Error('未提供认证信息');
        err.status = 401;
        throw err;
    }

    // 支持不同大小写的 Bearer 前缀，并安全地提取 token
    let token = authHeader;
    if (/^Bearer\s+/i.test(authHeader)) {
        token = authHeader.replace(/^Bearer\s+/i, '');
    }

    const tokenCacheKey = CacheKeys.tokenKey(token);

    // 从 Redis 获取 token 数据
    const tokenData = await redis.get(tokenCacheKey);
    if (!tokenData) {
        const err = new Error('token无效');
        err.status = 401;
        throw err;
    }

    const parsedTokenData = JSON.parse(tokenData);

    // 检查过期时间
    const expiresAt = new Date(parsedTokenData.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        // token 已过期，从 Redis 删除
        await redis.del(tokenCacheKey);
        const err = new Error('token已过期');
        err.status = 401;
        throw err;
    }

    // 获取管理员用户名
    const adminResult = await db.query(
        'SELECT value FROM configs WHERE key = $1',
        ['admin']
    );
    const adminConfig = adminResult.rows[0].value;

    // 更新最后使用时间
    parsedTokenData.last_used_at = new Date().toISOString();
    await redis.set(tokenCacheKey, JSON.stringify(parsedTokenData), 'EX', 3600);

    req.user = {
        username: adminConfig.username,
        tokenId: parsedTokenData.id,
        tokenName: parsedTokenData.name
    };
    next();
}

module.exports = asyncHandler(verifyAuth);
