const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const { clearPostListCache, clearPostCache } = require('../../utils/cache');

// 修改文章 slug 接口
// 前端发送 JSON: { oldSlug, newSlug }
router.put('/', async (req, res) => {
    try {
        const { oldSlug, newSlug } = req.body;

        if (!oldSlug || !newSlug) {
            return res.status(400).json({ error: 'newSlug 和 oldSlug 是必须项' });
        }

        // 检查旧 slug 是否存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [oldSlug]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: '文章未找到' });
        }

        // 检查新 slug 是否已经存在
        const conflict = await db.query('SELECT * FROM articles WHERE slug = $1', [newSlug]);
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: '已存在使用此 slug 的文章' });
        }

        // 更新 slug
        const result = await db.query(
            'UPDATE articles SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING *',
            [newSlug, oldSlug]
        );

        const updatedArticle = result.rows[0];

        await clearPostListCache();
        await clearPostCache(oldSlug);
        await clearPostCache(newSlug);

        res.json({ message: 'slug 更新成功', article: updatedArticle });
    } catch (err) {
        console.error('slug 更新失败：', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;