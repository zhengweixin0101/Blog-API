const express = require('express');
const router = express.Router();
const db = require('../db.js');
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 修改文章 slug 接口
// 前端发送 JSON: { oldSlug, newSlug }
router.put('/', async (req, res) => {
    try {
        const { oldSlug, newSlug } = req.body;

        if (!oldSlug || !newSlug) {
            return res.status(400).json({ error: 'newSlug and oldSlug are required' });
        }

        // 检查旧 slug 是否存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [oldSlug]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }

        // 检查新 slug 是否已经存在
        const conflict = await db.query('SELECT * FROM articles WHERE slug = $1', [newSlug]);
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'Article with this slug already exists' });
        }

        // 更新 slug
        const result = await db.query(
            'UPDATE articles SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING *',
            [newSlug, oldSlug]
        );

        const updatedArticle = result.rows[0];
        if (redis) {
            await redis.del('posts:list');
            await redis.del('posts:list:all');
            await redis.del(`post:${oldSlug}`);
        }

        res.json({ message: 'Slug updated successfully', article: updatedArticle });
    } catch (err) {
        console.error('UpdateSlug Error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

module.exports = router;