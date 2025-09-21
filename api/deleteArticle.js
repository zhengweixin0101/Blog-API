const express = require('express');
const router = express.Router();
const db = require('../db');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

// 删除文章接口
// 前端发送 JSON: { slug: '文章slug' }
router.delete('/', async (req, res) => {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: 'Slug is required' });

    try {
        const result = await db.query(
            'DELETE FROM articles WHERE slug = $1 RETURNING slug',
            [slug]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }

        const articleSlug = result.rows[0].slug;

        await redis.del('posts:list:published');
        await redis.del('posts:list:all');
        await redis.del(`post:${articleSlug}`);

        res.json({ message: `Article '${slug}' deleted successfully` });
    } catch (err) {
        console.error(`Error deleting article ${slug}:`, err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
