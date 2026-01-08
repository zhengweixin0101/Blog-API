const express = require('express');
const router = express.Router();
const db = require('../../db');

const redis = db.redis;

// 获取文章列表接口
// 直接请求，默认只返回已发布文章
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

        const FIELD_MAP = {
            slug: 'slug',
            title: 'title',
            description: 'description',
            tags: 'tags',
            published: 'published',
            date: "TO_CHAR(date, 'YYYY-MM-DD') AS date",
        };

        const allowedFields = Object.keys(FIELD_MAP);

        const columns = fields
            ? fields
                .filter(f => allowedFields.includes(f))
                .map(f => FIELD_MAP[f])
            : Object.values(FIELD_MAP);

        const { rows } = await db.query(
            `SELECT ${columns.join(', ')}
             FROM articles
             ${all ? '' : 'WHERE published = true'}
             ORDER BY date DESC`
        );

        if (redis) {
            try {
                await redis.set(cacheKey, JSON.stringify(rows), 'EX', 30 * 24 * 60 * 60);
            } catch (err) {
                console.error('缓存出错了：', err);
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('获取文章列表失败：', err);
        res.status(500).json({ error: '数据库错误' });
    }
});

module.exports = router;