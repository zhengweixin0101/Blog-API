const express = require('express');
const router = express.Router();
const db = require('../../db');
const { clearPostListCache, clearPostCache } = require('../../utils/cache');

// 删除文章接口
// 前端发送 JSON: { slug: '文章slug' }
router.delete('/', async (req, res) => {
    const { slug } = req.body;

    try {
        const result = await db.query(
            'DELETE FROM articles WHERE slug = $1 RETURNING slug',
            [slug]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '文章未找到' });
        }

        await clearPostListCache();
        await clearPostCache(slug);

        res.json({ message: `文章 '${slug}' 删除成功` });
    } catch (err) {
        console.error(`删除文章 ${slug} 时出现错误:`, err);
        res.status(500).json({ error: '数据库错误' });
    }
});

module.exports = router;
