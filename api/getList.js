const express = require('express');
const router = express.Router();
const db = require('./db');

router.get('/', async (_req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT slug, title, date, description, tags 
            FROM articles 
            ORDER BY date DESC
        `);

        const formattedRows = rows.map(row => ({
            ...row,
            date: row.date.toISOString().split('T')[0]
        }));

        res.json(formattedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;