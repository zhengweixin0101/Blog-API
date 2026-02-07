const express = require('express');
const db = require('../../db.js');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/config/get - 获取配置
 * Query: { key }
 */
router.get('/', asyncHandler(async (req, res) => {
    const { key } = req.query;

    if (!key) {
        return res.status(400).json({
            success: false,
            error: '缺少必须的查询参数: key'
        });
    }

    // 从数据库获取配置
    const result = await db.query(
        'SELECT * FROM configs WHERE key = $1',
        [key]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            success: false,
            error: '配置不存在'
        });
    }

    const config = result.rows[0];

    res.json({
        success: true,
        data: {
            key: config.key,
            value: config.value,
            description: config.description,
            updatedAt: config.updated_at
        }
    });
}));

module.exports = router;
