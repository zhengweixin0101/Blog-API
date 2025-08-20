const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取文章内容接口
// 直接请求 /api/article?slug={slug}
router.get('/', async (req, res) => {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: 'Slug is required' });

    try {
        const { rows } = await db.query(
            'SELECT slug, title, description, tags, content, TO_CHAR(date, \'YYYY-MM-DD\') AS date FROM articles WHERE slug = $1',
            [slug]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Article not found' });

        const article = rows[0];

        res.json({
            frontmatter: {
                slug: article.slug,
                title: article.title,
                date: article.date,
                description: article.description || '',
                tags: article.tags || []
            },
            content: article.content
        });
    } catch (err) {
        console.error(`Error fetching article ${slug}:`, err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;