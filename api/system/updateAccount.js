const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../../db.js');
const { asyncHandler } = require('../../middleware/errorHandler');
const { CacheKeys } = require('../../utils/constants');
const redis = db.redis;

const router = express.Router();

/**
 * POST /api/system/updateAccount - 修改用户名或密码
 * Body: { username?, password?, currentPassword }
 * 需要认证
 */
router.post('/', asyncHandler(async (req, res) => {
    const { username, password, currentPassword } = req.body;

    // 从 configs 表获取当前管理员信息
    const result = await db.query(
        'SELECT value FROM configs WHERE key = $1',
        ['admin']
    );

    if (result.rows.length === 0) {
        const err = new Error('账号不存在，这可能是个Bug');
        err.status = 404;
        throw err;
    }

    const adminConfig = result.rows[0].value;

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, adminConfig.password);
    if (!isCurrentPasswordValid) {
        const err = new Error('密码错误');
        err.status = 401;
        throw err;
    }

    // 构建更新后的配置
    const updatedConfig = { ...adminConfig };

    if (username) {
        updatedConfig.username = username;
    }

    if (password) {
        updatedConfig.password = await bcrypt.hash(password, 10);
    }

    // 更新 configs 表
    await db.query(
        `UPDATE configs
         SET value = $1
         WHERE key = $2`,
        [JSON.stringify(updatedConfig), 'admin']
    );

    // 更新 Redis 缓存
    await redis.set(CacheKeys.configKey('admin'), JSON.stringify(updatedConfig), 'EX', 3600);

    res.json({
        success: true,
        message: '账号信息更新成功'
    });
}));

module.exports = router;
