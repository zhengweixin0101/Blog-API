// api/talks/edit.js
const express = require('express');
const router = express.Router();
const db = require('../../db.js');

// 编辑说说接口
// 前端发送 JSON: { id, content?, tags?, links?, img? }
router.put('/', async (req, res) => {
    const { id, content, tags, links, img } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    try {
        const fields = [];
        const values = [];
        let idx = 1;

        if (content !== undefined) {
            fields.push(`content = $${idx++}`);
            values.push(content);
        }
        if (tags !== undefined) {
            fields.push(`tags = $${idx++}`);
            values.push(tags);
        }
        if (links !== undefined) {
            fields.push(`links = $${idx++}`);
            values.push(Array.isArray(links) ? links : [links]);
        }
        if (img !== undefined) {
            fields.push(`img = $${idx++}`);
            values.push(img);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);

        const query = `
            UPDATE talks
            SET ${fields.join(', ')}
            WHERE id = $${idx}
            RETURNING *
        `;

        const result = await db.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Talk not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;