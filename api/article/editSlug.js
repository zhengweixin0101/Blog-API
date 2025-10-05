const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 修改文章 slug 接口
// 前端发送 JSON: { oldSlug, newSlug }
router.put('/', async (req, res) => {
    try {
        const { oldSlug, newSlug } = req.body;

        if (!oldSlug || !newSlug) {
            return res.status(400).json({ error: 'newSlug 和 oldSlug 是必须项' });
        }

        // 检查旧 slug 是否存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [oldSlug]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: '文章未找到' });
        }

        // 检查新 slug 是否已经存在
        const conflict = await db.query('SELECT * FROM articles WHERE slug = $1', [newSlug]);
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: '已存在使用此 slug 的文章' });
        }

        // 更新 slug
        const result = await db.query(
            'UPDATE articles SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING *',
            [newSlug, oldSlug]
        );

        const updatedArticle = result.rows[0];
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
            await redis.del(`post:${oldSlug}`);
        }

        res.json({ message: 'slug 更新成功', article: updatedArticle });
    } catch (err) {
        console.error('slug 更新失败：', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

module.exports = router;