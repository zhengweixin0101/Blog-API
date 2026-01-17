const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const { clearPostListCache, clearPostCache } = require('../../utils/cache');
const { asyncHandler } = require('../../middleware/errorHandler');

/**
 * PUT /api/article/edit-slug - 修改文章 slug
 * Body: { oldSlug, newSlug }
 */
router.put('/', asyncHandler(async (req, res) => {
    const { oldSlug, newSlug } = req.body;

    // 检查旧 slug 是否存在
    const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [oldSlug]);
    if (existing.rows.length === 0) {
        const err = new Error('文章未找到');
        err.status = 404;
        throw err;
    }

    // 检查新 slug 是否已经存在
    const conflict = await db.query('SELECT * FROM articles WHERE slug = $1', [newSlug]);
    if (conflict.rows.length > 0) {
        const err = new Error('已存在使用此 slug 的文章');
        err.status = 409;
        throw err;
    }

    // 更新 slug
    const result = await db.query(
        'UPDATE articles SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING *',
        [newSlug, oldSlug]
    );

    const updatedArticle = result.rows[0];

    await clearPostListCache();
    await clearPostCache(oldSlug);
    await clearPostCache(newSlug);

    res.json({
        success: true,
        message: 'slug 更新成功',
        article: updatedArticle
    });
}));

module.exports = router;