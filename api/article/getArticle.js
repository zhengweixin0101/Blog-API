const express = require('express');
const router = express.Router();
const db = require('../../db');
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 获取文章内容接口
// 直接请求 ?slug={slug}
router.get('/', async (req, res) => {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: '缺少 slug' });

    const cacheKey = `post:${slug}`;

    try {
        let cached;
        if (redis) {
            cached = await redis.get(cacheKey);
        }
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const { rows } = await db.query(
            `SELECT id, slug, title, description, tags, content,
                    TO_CHAR(date, 'YYYY-MM-DD') AS date,
                    published
             FROM articles
             WHERE slug = $1`,
            [slug]
        );

        if (!rows[0]) return res.status(404).json({ error: '文章未找到' });

        const article = rows[0];
        const responseData = {
            frontmatter: {
                slug: article.slug,
                title: article.title,
                date: article.date,
                description: article.description || '',
                tags: article.tags || [],
                published: article.published
            },
            content: article.content
        };

        if (redis) {
            try {
                await redis.set(cacheKey, JSON.stringify(responseData));
            } catch (err) {
                console.error('缓存出错了：', err);
            }
        }

        res.json(responseData);
    } catch (err) {
        console.error(`获取文章 ${slug} 失败:`, err);
        res.status(500).json({ error: '数据库错误' });
    }
});

module.exports = router;