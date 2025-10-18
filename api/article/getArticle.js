const express = require('express');
const router = express.Router();
const db = require('../../db');
const Redis = require('ioredis');
const { marked } = require('marked');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 获取文章内容接口
// 直接请求 ?slug={slug}
// 可选参数 &type=markdown|html，默认 markdown
router.get('/', async (req, res) => {
    const { slug, type = 'markdown' } = req.query;
    if (!slug) return res.status(400).json({ error: '缺少 slug' });

    const cacheKey = type === 'html' ? `post:html:${slug}` : `post:${slug}`;

    try {
        if (redis) {
            const cached = await redis.get(cacheKey);
            if (cached) return res.json(JSON.parse(cached));
        }

        const { rows } = await db.query(
            `SELECT slug, title, description, tags, content,
                    TO_CHAR(date, 'YYYY-MM-DD') AS date,
                    published
             FROM articles
             WHERE slug = $1`,
            [slug]
        );

        if (!rows[0]) return res.status(404).json({ error: '文章未找到' });

        const article = rows[0];

        const content =
            type === 'html'
                ? marked.parse(article.content || '')
                : article.content || '';

        const responseData = {
            frontmatter: {
                slug: article.slug,
                title: article.title,
                date: article.date,
                description: article.description || '',
                tags: article.tags || [],
                published: article.published,
            },
            content,
        };

        if (redis) {
            try {
                await redis.set(
                    cacheKey,
                    JSON.stringify(responseData),
                    'EX',
                    30 * 24 * 60 * 60
                );
            } catch (err) {
                console.error('缓存出错：', err);
            }
        }

        res.json(responseData);
    } catch (err) {
        console.error(`获取文章 ${slug} 失败:`, err);
        res.status(500).json({ error: '数据库错误' });
    }
});

module.exports = router;