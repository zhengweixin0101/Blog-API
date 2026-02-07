const express = require('express');
const db = require('../../db.js');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

/**
 * POST /api/config/set - 设置或修改配置
 * Body: { key, value, description? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { key, value, description } = req.body;

    if (!key || value === undefined) {
        return res.status(400).json({
            success: false,
            error: '缺少必须的请求参数: key 和 value'
        });
    }

    // 检查配置是否已存在
    const existingConfig = await db.query(
        'SELECT * FROM configs WHERE key = $1',
        [key]
    );

    if (existingConfig.rows.length > 0) {
        // 更新现有配置
        await db.query(
            `UPDATE configs
             SET value = $1, description = $2, updated_at = NOW()
             WHERE key = $3`,
            [JSON.stringify(value), description || null, key]
        );
    } else {
        // 创建新配置
        await db.query(
            `INSERT INTO configs (key, value, description)
             VALUES ($1, $2, $3)`,
            [key, JSON.stringify(value), description || null]
        );
    }

    res.json({
        success: true,
        message: existingConfig.rows.length > 0 ? '配置更新成功' : '配置创建成功',
        data: {
            key,
            value,
            description
        }
    });
}));

module.exports = router;
