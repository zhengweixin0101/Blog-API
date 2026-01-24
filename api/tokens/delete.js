const express = require('express');
const db = require('../../db.js');
const verifyAuth = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { deleteTokenSchema, validate } = require('../../middleware/validate');

const router = express.Router();

/**
 * DELETE /api/tokens/delete - 删除 token（从数据库中物理删除）
 * Body: { id }
 */
router.delete('/', verifyAuth, validate(deleteTokenSchema), asyncHandler(async (req, res) => {
    const { id } = req.body;

    const result = await db.query(
        `DELETE FROM tokens WHERE id = $1 RETURNING name`,
        [id]
    );

    if (result.rows.length === 0) {
        const err = new Error('Token 不存在');
        err.status = 404;
        throw err;
    }

    res.json({
        success: true,
        message: `Token '${result.rows[0].name}' 已删除`
    });
}));

module.exports = router;
