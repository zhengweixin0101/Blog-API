const express = require('express');
const router = express.Router();
const db = require('../db');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

// 获取文章列表接口
// 直接请求 /api/list，默认只返回已发布文章
// /api/list?posts=all 返回全部文章
router.get('/', async (req, res) => {
    try {
        const all = req.query.posts === 'all';
        const cacheKey = all ? 'posts:list:all' : 'posts:list:published';

        // 查询缓存
        const cached = await redis.get(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        // 查询数据库
        const { rows } = await db.query(
            `SELECT slug, title, description, tags,
                    TO_CHAR(date, 'YYYY-MM-DD') AS date,
                    published
             FROM articles
             ${all ? '' : 'WHERE published = true'}
             ORDER BY date DESC`
        );

        const formatted = rows.map(row => ({
            slug: row.slug,
            title: row.title,
            date: row.date,
            description: row.description || null,
            tags: row.tags || null,
            published: row.published
        }));

        // 写入缓存
        await redis.set('posts:list:published', JSON.stringify(
            formatted.filter(row => row.published)
        ));
        await redis.set('posts:list:all', JSON.stringify(formatted));

        res.json(all ? formatted : formatted.filter(row => row.published));
    } catch (err) {
        console.error('Error fetching article list:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;