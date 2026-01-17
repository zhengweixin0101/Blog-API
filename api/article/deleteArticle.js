const express = require('express');
const router = express.Router();
const db = require('../../db');
const { clearPostListCache, clearPostCache } = require('../../utils/cache');
const { asyncHandler } = require('../../middleware/errorHandler');

/**
 * DELETE /api/article/delete - 删除文章
 * Body: { slug }
 */
router.delete('/', asyncHandler(async (req, res) => {
    const { slug } = req.body;

    const result = await db.query(
        'DELETE FROM articles WHERE slug = $1 RETURNING slug',
        [slug]
    );

    if (result.rowCount === 0) {
        const err = new Error('文章未找到');
        err.status = 404;
        throw err;
    }

    await clearPostListCache();
    await clearPostCache(slug);

    res.json({ message: `文章 '${slug}' 删除成功` });
}));

module.exports = router;
