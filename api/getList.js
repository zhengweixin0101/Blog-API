const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (_req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT 
                slug, 
                title, 
                TO_CHAR(date, 'YYYY-MM-DD') AS date,
                description, 
                tags
            FROM articles
            ORDER BY date DESC
        `);

        const formattedRows = rows.map(row => ({
            slug: row.slug,
            title: row.title,
            date: row.date,
            description: row.description,
            tags: row.tags || []
        }));

        res.json(formattedRows);
    } catch (err) {
        console.error('getList Error:', err);
        res.status(500).json({ error: 'Database error', stack: err.stack });
    }
});

module.exports = router;