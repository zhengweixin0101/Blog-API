const express = require('express');
const router = express.Router();
const db = require('../db.js');
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 更新文章接口
// 前端发送 JSON: { slug, title?, content?, tags?, description?, date?, published? }
router.put('/', async (req, res) => {
    try {
        const { slug, title, content, tags, description, date, published } = req.body;

        if (!slug) {
            return res.status(400).json({ error: 'slug is required' });
        }

        // 检查文章是否存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
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
        const articleSlug = existing.rows[0].slug;

        if (redis) {
            await redis.del('posts:list');
            await redis.del('posts:list:all');
            await redis.del(`post:${articleSlug}`);
        }

        res.json({ message: 'Article updated successfully', article: result.rows[0] });

    } catch (err) {
        console.error('UpdateArticle Error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

module.exports = router;