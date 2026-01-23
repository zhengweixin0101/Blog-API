const express = require('express');
const db = require('../../db.js');
const verifyAuth = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const Joi = require('joi');
const { validate } = require('../../middleware/validate');

const router = express.Router();

// 请求验证 schema
const revokeTokenSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});

/**
 * DELETE /api/tokens/revoke - 删除 token
 * Body: { id }
 */
router.delete('/', verifyAuth, validate(revokeTokenSchema), asyncHandler(async (req, res) => {
    const { id } = req.body;

    const result = await db.query(
        `UPDATE tokens SET is_active = false WHERE id = $1 RETURNING name`,
        [id]
    );

    if (result.rows.length === 0) {
        const err = new Error('Token 不存在');
        err.status = 404;
        throw err;
    }

    res.json({
        success: true,
        message: `Token '${result.rows[0].name}' 已撤销`
    });
}));

module.exports = router;
