const db = require('../db.js');

async function verifyAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: '未提供认证信息' });
    }

    // 支持不同大小写的 Bearer 前缀，并安全地提取 token
    let token = authHeader;
    if (/^Bearer\s+/i.test(authHeader)) {
        token = authHeader.replace(/^Bearer\s+/i, '');
    }

    const result = await db.query(
        'SELECT id, username, token, token_expires_at FROM admin WHERE token = $1',
        [token]
    );

    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'token无效' });
    }

    const admin = result.rows[0];

    // 处理可能为 null/undefined/字符串/Date 的过期字段
    const expiresAt = admin.token_expires_at ? new Date(admin.token_expires_at) : null;
    if (!expiresAt || isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        return res.status(401).json({ error: 'token已过期' });
    }

    req.user = { id: admin.id, username: admin.username };
    next();
}

module.exports = verifyAuth;
