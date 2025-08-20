const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取文章列表接口
// 直接请求 /api/list，默认只返回已发布文章
// /api/list?posts=all 返回全部文章
router.get('/', async (req, res) => {
    try {
        const all = req.query.posts === 'all';

        const { rows } = await db.query(
            `SELECT slug, title, description, tags,
                    TO_CHAR(date, 'YYYY-MM-DD') AS date,
                    published
             FROM articles
             ${all ? '' : 'WHERE published = true'}
             ORDER BY date DESC`
        );

        res.json(rows.map(row => ({
            slug: row.slug,
            title: row.title,
            date: row.date,
            description: row.description || null,
            tags: row.tags || null,
            published: row.published
        })));
    } catch (err) {
        console.error('Error fetching article list:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;