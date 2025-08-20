const express = require('express');
const router = express.Router();
const db = require('./db');
const { format } = require('date-fns');

router.get('/', async (req, res) => {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: 'Slug is required' });

    try {
        const { rows } = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
        if (!rows[0]) return res.status(404).json({ error: 'Article not found' });

        const article = rows[0];
        const formattedDate = format(new Date(article.date), 'yyyy-MM-dd');

        res.json({
            frontmatter: {
                slug: article.slug,
                title: article.title,
                date: formattedDate,
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