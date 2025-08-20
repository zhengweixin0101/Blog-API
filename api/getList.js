const express = require('express');
const router = express.Router();
const db = require('./db');

router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT slug, title, date, description, tags 
            FROM articles 
            ORDER BY date DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
