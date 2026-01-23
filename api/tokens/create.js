const express = require('express');
const crypto = require('crypto');
const db = require('../../db.js');
const verifyAuth = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const Joi = require('joi');
const { validate } = require('../../middleware/validate');
const { Auth } = require('../../utils/config');

const router = express.Router();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 请求验证 schema
const createTokenSchema = Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(500).allow('', null),
    expiresIn: Joi.number()
        .integer()
        .allow(null) // 允许设置 null 表示永不过期
});

/**
 * POST /api/tokens/create - 创建新 token
 * Body: { name, description?, expiresIn? }
 */
router.post('/', verifyAuth, validate(createTokenSchema), asyncHandler(async (req, res) => {
    const { name, description, expiresIn } = req.body;

    const token = generateToken();
    // 不传 expiresIn 时默认 3 天，传 null 时永不过期
    const actualExpiresIn = expiresIn === undefined ? Auth.TOKEN_EXPIRY : expiresIn;
    const tokenExpiresAt = actualExpiresIn === null
        ? null
        : new Date(Date.now() + actualExpiresIn);

    const result = await db.query(
        `INSERT INTO tokens (token, name, description, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, expires_at, created_at`,
        [token, name, description || null, tokenExpiresAt]
    );

    res.json({
        success: true,
        message: 'Token 创建成功',
        data: {
            id: result.rows[0].id,
            name: result.rows[0].name,
            description: result.rows[0].description,
            token: token, // 只在创建时返回完整 token
            expiresAt: result.rows[0].expires_at,
            createdAt: result.rows[0].created_at,
            expiresIn: actualExpiresIn
        }
    });
}));

module.exports = router;
