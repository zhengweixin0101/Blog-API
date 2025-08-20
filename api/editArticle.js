const express = require('express');
const router = express.Router();
const db = require('../db.js'); // db.js 在同目录

// 辅助函数：将 JS 数组转 PostgreSQL text[] 字符串
function arrayToPgTextArray(arr) {
    if (!arr || arr.length === 0) return '{}';
    return '{' + arr.map(s => s.replace(/"/g, '\\"')).join(',') + '}';
}

// 编辑或创建文章接口
// 前端发送 JSON: { slug, title, content, tags?, description? }
router.put('/', async (req, res) => {
    try {
        const { slug, title, content, tags, description } = req.body;

        if (!slug || !title || !content) {
            return res.status(400).json({ error: 'slug, title and content are required' });
        }

        // 检查文章是否存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);

        if (existing.rows.length > 0) {
            // 文章存在 → 更新
            const fields = [];
            const values = [];
            let idx = 1;

            if (title !== undefined) {
                fields.push(`title = $${idx++}`);
                values.push(title);
            }
            if (content !== undefined) {
                fields.push(`content = $${idx++}`);
                values.push(content);
            }
            if (tags !== undefined) {
                fields.push(`tags = $${idx++}::text[]`);
                values.push(arrayToPgTextArray(tags));
            }
            if (description !== undefined) {
                fields.push(`description = $${idx++}`);
                values.push(description);
            }

            fields.push(`updated_at = NOW()`);
            values.push(slug);

            const query = `
        UPDATE articles
        SET ${fields.join(', ')}
        WHERE slug = $${idx}
        RETURNING *
      `;

            const result = await db.query(query, values);
            return res.json({ message: 'Article updated successfully', article: result.rows[0] });

        } else {
            // 文章不存在 → 创建
            const result = await db.query(
                `INSERT INTO articles (slug, title, content, tags, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4::text[], $5, NOW(), NOW())
         RETURNING *`,
                [
                    slug,
                    title,
                    content,
                    tags ? arrayToPgTextArray(tags) : '{}',
                    description || null
                ]
            );
            return res.json({ message: 'Article created successfully', article: result.rows[0] });
        }

    } catch (err) {
        console.error('EditArticle Error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

module.exports = router;
