const express = require('express');
const db = require('../../db.js');
const router = express.Router();
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 添加说说接口
// 前端发送 JSON: { content, links?, imgs?, tags? }
router.post('/', async (req, res) => {
    try {
        const { content, links = [], imgs = [], tags = [], created_at } = req.body;

        if (!content) {
            return res.status(400).json({ success: false, message: '内容不能为空' });
        }

        const linksArray = Array.isArray(links) ? links : [links];
        const imgsArray = Array.isArray(imgs) ? imgs : [imgs];
        const createdAtValue = created_at ? new Date(created_at) : new Date();

        const query = `
            INSERT INTO talks (content, links, imgs, tags, created_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;

        const result = await db.query(query, [
            content,
            JSON.stringify(linksArray),
            JSON.stringify(imgsArray),
            tags,
            createdAtValue
        ]);

        if (redis) {
            const keys = await redis.keys('talks:*');
            if (keys.length > 0) {
                await redis.del(keys);
            }
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '添加说说失败' });
    }
});

module.exports = router;