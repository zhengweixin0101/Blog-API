const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const { clearTalksCache } = require('../../utils/cache');
const { asyncHandler } = require('../../middleware/errorHandler');

/**
 * PUT /api/talks/edit - 编辑说说
 * Body: { id, content?, location?, tags?, links?, imgs? }
 */
router.put('/', asyncHandler(async (req, res) => {
    const { id, content, location, tags, links, imgs } = req.body;

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
        const err = new Error('没有需要更新的字段');
        err.status = 400;
        throw err;
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
        const err = new Error('说说不存在');
        err.status = 404;
        throw err;
    }

    await clearTalksCache();

    res.json({
        success: true,
        message: '说说更新成功',
        talk: result.rows[0]
    });
}));

module.exports = router;