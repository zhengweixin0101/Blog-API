const express = require('express');
const router = express.Router();
const db = require('../db');

const formatDate = d => d ? new Date(d).toISOString().split('T')[0] : null;

router.get('/', async (_req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT id, slug, title, date, description, tags, content, published, created_at, updated_at
            FROM articles
            ORDER BY date DESC
        `);

        const formattedRows = rows.map(row => ({
            ...row,
            date: formatDate(row.date),
            created_at: formatDate(row.created_at),
            updated_at: formatDate(row.updated_at),
            tags: row.tags || []
        }));

        res.json(formattedRows);
    } catch (err) {
        console.error('getList Error:', err);
        res.status(500).json({ error: 'Database error', stack: err.stack });
    }
});

module.exports = router;