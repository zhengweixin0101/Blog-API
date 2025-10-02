const express = require('express');
const db = require('../../db.js');
const router = express.Router();

// 添加说说接口
// 前端发送 JSON: { content, links?, img?, tags? }
router.post('/', async (req, res) => {
    try {
        const { content, links = [], img = [], tags = [] } = req.body;

        if (!content) {
            return res.status(400).json({ success: false, message: '内容不能为空' });
        }

        const linksArray = Array.isArray(links) ? links : [links];

        const query = `
            INSERT INTO talks (content, links, img, tags)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const result = await db.query(query, [content, JSON.stringify(linksArray), img, tags]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '添加说说失败' });
    }
});

module.exports = router;