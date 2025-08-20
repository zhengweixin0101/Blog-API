const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT slug, title, description, tags, date 
             FROM articles 
             WHERE published = true
             ORDER BY date DESC`
        );

        res.json(rows.map(row => ({
            slug: row.slug,
            title: row.title,
            description: row.description || null,
            tags: row.tags || null,
            date: row.date
        })));
    } catch (err) {
        console.error('Error fetching article list:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;