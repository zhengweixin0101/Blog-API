const express = require('express');
const db = require('../../db.js');
const verifyAuth = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const { toggleTokenSchema, validate } = require('../../middleware/validate');

const router = express.Router();

/**
 * POST /api/tokens/toggle - 启用或停用 token
 * Body: { id, isActive }
 */
router.post('/', verifyAuth, validate(toggleTokenSchema), asyncHandler(async (req, res) => {
    const { id, isActive } = req.body;

    const result = await db.query(
        `UPDATE tokens SET is_active = $2 WHERE id = $1 RETURNING name`,
        [id, isActive]
    );

    if (result.rows.length === 0) {
        const err = new Error('Token 不存在');
        err.status = 404;
        throw err;
    }

    const action = isActive ? '启用' : '关闭';
    res.json({
        success: true,
        message: `Token '${result.rows[0].name}' 已${action}`,
        data: {
            id,
            name: result.rows[0].name,
            isActive
        }
    });
}));

module.exports = router;
