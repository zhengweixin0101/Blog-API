const express = require('express');
const router = express.Router();
const db = require('../db.js');

// 修改文章 slug 接口
// 前端发送 JSON: { oldSlug, newSlug }
router.put('/', async (req, res) => {
    try {
        const { oldSlug, newSlug } = req.body;

        if (!oldSlug || !newSlug) {
            return res.status(400).json({ error: 'oldSlug 和 newSlug 都是必填项' });
        }

        // 检查旧 slug 是否存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [oldSlug]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: '文章不存在' });
        }

        // 检查新 slug 是否已经存在
        const conflict = await db.query('SELECT * FROM articles WHERE slug = $1', [newSlug]);
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: '新 slug 已存在' });
        }

        // 更新 slug
        const result = await db.query(
            'UPDATE articles SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING *',
            [newSlug, oldSlug]
        );

        res.json({ message: 'Slug 更新成功', article: result.rows[0] });

    } catch (err) {
        console.error('UpdateSlug Error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

module.exports = router;