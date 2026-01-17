const express = require('express');
const router = express.Router();
const db = require('../../db');
const { clearTalksCache } = require('../../utils/cache');
const { asyncHandler } = require('../../middleware/errorHandler');

/**
 * DELETE /api/talks/delete - 删除说说
 * Body: { id }
 */
router.delete('/', asyncHandler(async (req, res) => {
    const { id } = req.body;

    const result = await db.query(
        'DELETE FROM talks WHERE id = $1 RETURNING id',
        [id]
    );

    if (result.rowCount === 0) {
        const err = new Error('说说未找到');
        err.status = 404;
        throw err;
    }

    await clearTalksCache();

    res.json({ message: `说说 '${id}' 删除成功` });
}));

module.exports = router;