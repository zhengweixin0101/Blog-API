const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const { clearPostListCache, clearPostCache } = require('../../utils/cache');
const { asyncHandler } = require('../../middleware/errorHandler');

/**
 * PUT /api/article/edit - 更新文章
 * Body: { slug, title?, content?, tags?, description?, date?, published? }
 */
router.put('/', asyncHandler(async (req, res) => {
    const { slug, title, content, tags, description, date, published } = req.body;

    // 检查文章是否存在
    const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
    if (existing.rows.length === 0) {
        const err = new Error('文章未找到');
        err.status = 404;
        throw err;
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (content !== undefined) { fields.push(`content = $${idx++}`); values.push(content); }
    if (tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(tags); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (date !== undefined) { fields.push(`date = $${idx++}`); values.push(date); }
    if (published !== undefined) { fields.push(`published = $${idx++}`); values.push(published); }

    fields.push(`updated_at = NOW()`);
    const query = `UPDATE articles SET ${fields.join(', ')} WHERE slug = $${idx} RETURNING *`;
    values.push(slug);

    const result = await db.query(query, values);

    await clearPostListCache();
    await clearPostCache(slug);

    res.json({
        success: true,
        message: '文章更新成功',
        article: result.rows[0]
    });
}));

module.exports = router;