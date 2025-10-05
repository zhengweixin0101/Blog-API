const express = require('express');
const router = express.Router();
const db = require('../../db');
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 删除文章接口
// 前端发送 JSON: { slug: '文章slug' }
router.delete('/', async (req, res) => {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: '缺少 slug' });

    try {
        const result = await db.query(
            'DELETE FROM articles WHERE slug = $1 RETURNING slug',
            [slug]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '文章未找到' });
        }

        const articleSlug = result.rows[0].slug;
        if (redis) {
            await redis.del(`post:${articleSlug}`);
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
                console.error('删除文章缓存时出错：', err);
            }
        }


        res.json({ message: `文章 '${slug}' 删除成功` });
    } catch (err) {
        console.error(`删除文章 ${slug} 时出现错误:`, err);
        res.status(500).json({ error: '数据库错误' });
    }
});

module.exports = router;
