const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const { clearPostListCache } = require('../../utils/cache');
const { asyncHandler } = require('../../middleware/errorHandler');

/**
 * POST /api/article/add - 添加文章
 * Body: { slug, title?, content?, tags?, description?, date?, published? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { slug, title, content, tags, description, date, published } = req.body;

    // 检查是否已存在
    const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
        const err = new Error('此 slug 的文章已存在');
        err.status = 409;
        throw err;
    }

    const result = await db.query(
        `INSERT INTO articles
            (slug, title, content, tags, description, date, published, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
            slug,
            title || '',
            content || '',
            tags || [],
            description || null,
            date || null,
            published !== undefined ? published : false
        ]
    );

        const newArticle = result.rows[0];
        await clearPostListCache();

        res.json({
            success: true,
            message: '文章添加成功',
            data: { article: newArticle }
        });
}));

module.exports = router;