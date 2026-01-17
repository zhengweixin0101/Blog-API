const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const { clearPostListCache } = require('../../utils/cache');

// 添加文章接口
// 前端发送 JSON: { slug, title?, content?, tags?, description?, date?, published? }
router.post('/', async (req, res) => {
    try {
        const { slug, title, content, tags, description, date, published } = req.body;

        if (!slug) {
            return res.status(400).json({ error: '需要 slug 字段' });
        }

        // 检查是否已存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: '此 slug 的文章已存在' });
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

        const newArticle = result.rows[0];
        await clearPostListCache();

        res.json({ message: '文章添加成功', article: newArticle });
    } catch (err) {
        console.error('添加文章失败:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;