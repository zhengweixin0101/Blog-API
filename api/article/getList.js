const express = require('express');
const router = express.Router();
const db = require('../../db');
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 获取文章列表接口
// 直接请求 /api/list，默认只返回已发布文章
// ?posts=all 返回全部文章
// ?fields=slug,title,date 筛选返回字段
router.get('/', async (req, res) => {
    try {
        const all = req.query.posts === 'all';
        const fieldsQuery = req.query.fields;
        const fields = fieldsQuery ? fieldsQuery.split(',').map(f => f.trim()) : null;
        const cacheKey = fields
            ? (all ? `posts:list:fields:${fields.join(',')}:all` : `posts:list:fields:${fields.join(',')}`)
            : (all ? 'posts:list:all' : 'posts:list');

        let cached;
        if (redis) {
            cached = await redis.get(cacheKey);
        }
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const defaultColumns = ['slug', 'title', 'description', 'tags', "TO_CHAR(date, 'YYYY-MM-DD') AS date", 'published'];
        const columns = fields ? fields.map(f => {
            if (f === 'date') return "TO_CHAR(date, 'YYYY-MM-DD') AS date";
            return f;
        }) : defaultColumns;

        const { rows } = await db.query(
            `SELECT ${columns.join(', ')}
             FROM articles
             ${all ? '' : 'WHERE published = true'}
             ORDER BY date DESC`
        );

        // 永不过期的缓存键列表
        const noExpireKeys = ['posts:list', 'posts:list:all', 'posts:list:fields:slug'];

        // 设置缓存
        if (redis) {
            if (noExpireKeys.includes(cacheKey)) {
                await redis.set(cacheKey, JSON.stringify(rows));
            } else {
                await redis.set(cacheKey, JSON.stringify(rows), 'EX', 7 * 24 * 60 * 60);
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('Error fetching article list:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;