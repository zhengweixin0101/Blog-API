const express = require('express');
const router = express.Router();
const db = require('./db');

router.get('/', async (req, res) => {
    const { slug } = req.query;
    try {
        const { rows } = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
        if (!rows[0]) return res.status(404).json({ error: 'Article not found' });

        const article = rows[0];

        const formattedDate = new Date(article.date).toISOString().slice(0, 10);

        res.json({
            frontmatter: {
                slug: article.slug,
                title: article.title,
                date: formattedDate,
                description: article.description,
                tags: article.tags
            },
            content: article.content
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;