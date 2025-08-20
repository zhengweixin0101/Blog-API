const express = require('express');
const router = express.Router();
const db = require('../db.js');

// 编辑或创建文章接口
// 前端发送 JSON: { slug, title?, date?, tags?, description?, published?, content? }
router.put('/', async (req, res) => {
    try {
        const { slug, title, content, tags, description, date, published } = req.body;

        if (!slug) {
            return res.status(400).json({ error: 'slug is required' });
        }

        // 检查文章是否存在
        const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);

        if (existing.rows.length > 0) {
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
                fields.push(`tags = $${idx++}`);
                values.push(tags);
            }
            if (description !== undefined) {
                fields.push(`description = $${idx++}`);
                values.push(description);
            }
            if (date !== undefined) {
                fields.push(`date = $${idx++}`);
                values.push(date);
            }
            if (published !== undefined) {
                fields.push(`published = $${idx++}`);
                values.push(published);
            }

            fields.push(`updated_at = NOW()`);

            const query = `
                UPDATE articles
                SET ${fields.join(', ')}
                WHERE slug = $${idx}
                RETURNING *
            `;
            values.push(slug);

            const result = await db.query(query, values);
            return res.json({ message: 'Article updated successfully', article: result.rows[0] });

        } else {
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
            return res.json({ message: 'Article created successfully', article: result.rows[0] });
        }

    } catch (err) {
        console.error('EditArticle Error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

module.exports = router;