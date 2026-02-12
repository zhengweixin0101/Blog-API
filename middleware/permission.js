const db = require('../db.js');
const { asyncHandler } = require('./errorHandler');

/**
 * 权限常量
 */
const Permissions = {
    // 文章权限
    ARTICLE_WRITE: 'article:write',   // 文章添加/编辑
    ARTICLE_DELETE: 'article:delete', // 文章删除

    // 说说权限
    TALK_WRITE: 'talk:write',         // 说说添加/编辑
    TALK_DELETE: 'talk:delete',       // 说说删除

    // 超级权限
    SUPER: 'super'
};

/**
 * 检查用户是否有指定权限
 * @param {Object} user - 用户对象（包含permissions）
 * @param {string|Array} requiredPermissions - 需要的权限（单个或数组）
 * @returns {boolean} 是否有权限
 */
function hasPermission(user, requiredPermissions) {
    if (!user || !user.permissions) {
        return false;
    }

    // 超级权限拥有所有权限
    if (user.permissions.includes(Permissions.SUPER)) {
        return true;
    }

    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    return permissions.some(perm => user.permissions.includes(perm));
}

/**
 * 创建权限验证中间件
 * @param {string|Array} requiredPermissions - 需要的权限
 * @param {boolean} allowAny - 是否允许满足任一权限即可（默认false，需要满足所有）
 */
function requirePermission(requiredPermissions, allowAny = false) {
    return asyncHandler(async (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                error: '未认证'
            });
        }

        const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

        // 超级权限拥有所有权限
        if (user.permissions.includes(Permissions.SUPER)) {
            return next();
        }

        let hasAccess = false;

        if (allowAny) {
            // 满足任一权限即可
            hasAccess = permissions.some(perm => user.permissions.includes(perm));
        } else {
            // 需要满足所有权限
            hasAccess = permissions.every(perm => user.permissions.includes(perm));
        }

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        next();
    });
}

/**
 * 特殊处理：/api/article/all 接口需要任意有效token
 */
async function requireValidToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: '未提供认证信息'
        });
    }

    // 支持不同大小写的 Bearer 前缀
    let token = authHeader;
    if (/^Bearer\s+/i.test(authHeader)) {
        token = authHeader.replace(/^Bearer\s+/i, '');
    }

    const { CacheKeys } = require('../utils/constants');
    const redis = db.redis;

    // 优先检查登录token
    const loginTokenData = await redis.get(CacheKeys.LOGIN_TOKEN);
    let tokenCacheKey, tokenData;

    if (loginTokenData) {
        const parsedLoginData = JSON.parse(loginTokenData);
        if (parsedLoginData.token === token) {
            tokenCacheKey = CacheKeys.LOGIN_TOKEN;
            tokenData = loginTokenData;
        }
    }

    // 不是登录token，检查其他token
    if (!tokenData) {
        tokenCacheKey = CacheKeys.tokenKey(token);
        tokenData = await redis.get(tokenCacheKey);
    }

    if (!tokenData) {
        return res.status(401).json({
            success: false,
            error: 'token无效'
        });
    }

    const parsedTokenData = JSON.parse(tokenData);

    // 检查过期时间
    const expiresAt = new Date(parsedTokenData.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        await redis.del(tokenCacheKey);
        return res.status(401).json({
            success: false,
            error: 'token已过期'
        });
    }

    // 更新最后使用时间
    parsedTokenData.last_used_at = new Date().toISOString();
    await redis.set(tokenCacheKey, JSON.stringify(parsedTokenData));

    next();
}

module.exports = {
    Permissions,
    hasPermission,
    requirePermission,
    requireValidToken
};
