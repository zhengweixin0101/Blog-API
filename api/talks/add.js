const express = require('express');
const db = require('../../db.js');
const router = express.Router();
const { clearTalksCache } = require('../../utils/cache');
const { asyncHandler } = require('../../middleware/errorHandler');

/**
 * POST /api/talks/add - 添加说说
 * Body: { content, location?, links?, imgs?, tags? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { content, location, links = [], imgs = [], tags = [] } = req.body;

    const linksArray = Array.isArray(links) ? links : [links];
    const imgsArray = Array.isArray(imgs) ? imgs : [imgs];

    const query = `
        INSERT INTO talks (content, location, links, imgs, tags, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *;
    `;

    const result = await db.query(query, [
        content,
        location || null,
        JSON.stringify(linksArray),
        JSON.stringify(imgsArray),
        tags,
    ]);

    await clearTalksCache();

    res.json({
        success: true,
        message: '说说添加成功',
        data: { talk: result.rows[0] }
    });
}));

module.exports = router;