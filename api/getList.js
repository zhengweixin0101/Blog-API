const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT slug, title, description, tags,
                    TO_CHAR(date, 'YYYY-MM-DD') AS date
             FROM articles 
             WHERE published = true
             ORDER BY date DESC`
        );

        res.json(rows.map(row => ({
            slug: row.slug,
            title: row.title,
            date: row.date,
            description: row.description || null,
            tags: row.tags || null,
        })));
    } catch (err) {
        console.error('Error fetching article list:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;