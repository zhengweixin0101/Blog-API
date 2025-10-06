const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const Redis = require('ioredis');

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// 编辑说说接口
// 前端发送 JSON: { id, content?, location?, tags?, links?, imgs? }
router.put('/', async (req, res) => {
    const { id, content, location, tags, links, imgs } = req.body;
    if (!id) return res.status(400).json({ error: '缺少 id' });

    try {
        const fields = [];
        const values = [];
        let idx = 1;

        if (content !== undefined) {
            fields.push(`content = $${idx++}`);
            values.push(content);
        }
        if (location !== undefined) {
            fields.push(`location = $${idx++}`);
            values.push(location);
        }
        if (tags !== undefined) {
            fields.push(`tags = $${idx++}`);
            values.push(tags);
        }
        if (links !== undefined) {
            fields.push(`links = $${idx++}`);
            values.push(JSON.stringify(Array.isArray(links) ? links : [links]));
        }
        if (imgs !== undefined) {
            fields.push(`imgs = $${idx++}`);
            values.push(JSON.stringify(Array.isArray(imgs) ? imgs : [imgs]));
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: '没有需要更新的字段' });
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
            return res.status(404).json({ error: '说说不存在' });
        }

        if (redis) {
            const keys = await redis.keys('talks:*');
            if (keys.length > 0) {
                await redis.del(keys);
            }
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '数据库错误' });
    }
});

module.exports = router;