const express = require('express');
const router = express.Router();
const db = require('../../db');
const { asyncHandler } = require('../../middleware/errorHandler');

const redis = db.redis;

// 文章字段映射配置
const FIELD_MAP = {
    slug: 'slug',
    title: 'title',
    description: 'description',
    tags: 'tags',
    published: 'published',
    date: "TO_CHAR(date, 'YYYY-MM-DD') AS date",
};

/**
 * GET /api/article/list - 获取文章列表
 * Query: ?posts=all&fields=slug,title,date
 */
router.get('/', asyncHandler(async (req, res) => {
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
            const parsed = JSON.parse(cached);
            return res.json({
                success: true,
                message: '获取成功',
                ...parsed
            });
        }

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
        await redis.set(cacheKey, JSON.stringify(rows), 'EX', 30 * 24 * 60 * 60);
    }

    res.json({
        success: true,
        message: '获取成功',
        ...rows
    });
}));

module.exports = router;