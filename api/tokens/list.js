const express = require('express');
const db = require('../../db.js');
const verifyAuth = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/tokens/list - 获取所有 token 列表
 */
router.get('/', verifyAuth, asyncHandler(async (req, res) => {
    const result = await db.query(
        `SELECT id, name, description, expires_at, created_at, last_used_at, is_active
         FROM tokens
         ORDER BY created_at DESC`
    );

    const tokens = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        isActive: row.is_active,
        // 隐藏完整 token，只显示前 8 位
        tokenPreview: row.token ? `${row.token.substring(0, 8)}...` : null
    }));

    res.json({
        success: true,
        message: '获取成功',
        data: tokens
    });
}));

module.exports = router;
