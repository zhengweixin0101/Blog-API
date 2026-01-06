const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 更新文章接口
// 前端发送 JSON: { slug, title?, content?, tags?, description?, date?, published? }
router.put('/', async (req, res) => {
    try {
        const { slug, title, content, tags, description, date, published } = req.body;

        if (!slug) {
            return res.status(400).json({ error: '缺少 slug' });
        }

        // 检查文章是否存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: '文章未找到' });
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
            try {
                let cursor = '0';
                do {
                    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'posts:list*', 'COUNT', 100);
                    cursor = nextCursor;
                    if (keys.length > 0) {
                        const batchSize = 50;
                        for (let i = 0; i < keys.length; i += batchSize) {
                            await redis.del(...keys.slice(i, i + batchSize));
                        }
                    }
                } while (cursor !== '0');
            } catch (err) {
                console.error('清除文章列表缓存时出错：', err);
            }
            await redis.del(`post:${articleSlug}`);
        }

        res.json({ message: '文章更新成功', article: result.rows[0] });

    } catch (err) {
        console.error('更新文章时遇到错误：', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;