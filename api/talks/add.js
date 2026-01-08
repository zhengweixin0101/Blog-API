const express = require('express');
const db = require('../../db.js');
const router = express.Router();

const redis = db.redis;

// 添加说说接口
// 前端发送 JSON: { content, location?, links?, imgs?, tags? }
router.post('/', async (req, res) => {
    try {
        const { content, location, links = [], imgs = [], tags = [] } = req.body;

        if (!content) {
            return res.status(400).json({ error: '内容不能为空' });
        }

        const linksArray = Array.isArray(links) ? links : [links];
        const imgsArray = Array.isArray(imgs) ? imgs : [imgs];

        const query = `
            INSERT INTO talks (content, location, links, imgs, tags, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *;
        `;

        const result = await db.query(query, [
            content,
            location || null,
            JSON.stringify(linksArray),
            JSON.stringify(imgsArray),
            tags,
        ]);

        if (redis) {
            const keys = await redis.keys('talks:*');
            if (keys.length > 0) {
                await redis.del(keys);
            }
        }

        res.json({ message: '说说添加成功', talk: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '添加说说失败' });
    }
});

module.exports = router;