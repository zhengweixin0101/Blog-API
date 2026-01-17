const express = require('express');
const db = require('../../db.js');
const router = express.Router();
const { clearTalksCache } = require('../../utils/cache');

// 添加说说接口
// 前端发送 JSON: { content, location?, links?, imgs?, tags? }
router.post('/', async (req, res) => {
    try {
        const { content, location, links = [], imgs = [], tags = [] } = req.body;

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

        await clearTalksCache();

        res.json({ message: '说说添加成功', talk: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '添加说说失败' });
    }
});

module.exports = router;