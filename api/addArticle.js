const express = require('express');
const router = express.Router();
const db = require('../db.js');

// 添加文章接口
// 前端发送 JSON: { slug, title?, content?, tags?, description?, date?, published? }
router.post('/', async (req, res) => {
    try {
        const { slug, title, content, tags, description, date, published } = req.body;

        if (!slug) {
            return res.status(400).json({ error: 'slug is required' });
        }

        // 检查是否已存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Article with this slug already exists' });
        }

        const result = await db.query(
            `INSERT INTO articles 
                (slug, title, content, tags, description, date, published, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             RETURNING *`,
            [
                slug,
                title || '',
                content || '',
                tags || [],
                description || null,
                date || null,
                published !== undefined ? published : false
            ]
        );

        res.json({ message: 'Article created successfully', article: result.rows[0] });
    } catch (err) {
        console.error('AddArticle Error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

module.exports = router;