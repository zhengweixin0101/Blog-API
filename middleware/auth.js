const db = require('../db.js');
const { asyncHandler } = require('./errorHandler');

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

    // 从 tokens 表验证 token
    const result = await db.query(
        `SELECT id, token, name, description, expires_at, is_active
         FROM tokens
         WHERE token = $1 AND is_active = true`,
        [token]
    );

    if (result.rows.length === 0) {
        const err = new Error('token无效');
        err.status = 401;
        throw err;
    }

    const tokenData = result.rows[0];

    // 处理可能为 null/undefined/字符串/Date 的过期字段
    // expires_at 为 null 表示永不过期
    if (tokenData.expires_at !== null) {
        const expiresAt = new Date(tokenData.expires_at);
        if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
            const err = new Error('token已过期');
            err.status = 401;
            throw err;
        }
    }

    // 获取管理员用户名
    const adminResult = await db.query(
        'SELECT value FROM configs WHERE key = $1',
        ['admin']
    );

    const adminConfig = adminResult.rows[0].value;

    // 更新最后使用时间
    await db.query(
        `UPDATE tokens SET last_used_at = NOW() WHERE id = $1`,
        [tokenData.id]
    );

    req.user = {
        username: adminConfig.username,
        tokenId: tokenData.id,
        tokenName: tokenData.name
    };
    next();
}

module.exports = asyncHandler(verifyAuth);
