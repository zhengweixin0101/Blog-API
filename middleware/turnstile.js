const axios = require('axios');
const { asyncHandler } = require('./errorHandler');
const db = require('../db');
const { CacheKeys } = require('../utils/constants');
const { Turnstile } = require('../utils/config');

const secretKey = process.env.TURNSTILE_SECRET_KEY;
const turnstileEnabled = !!secretKey;
const redis = db.redis;

/**
 * 检查指定 IP 是否需要人机验证
 * @param {string} ip - 客户端 IP
 * @returns {Promise<boolean>}
 */
async function isNeedVerification(ip) {
    const val = await redis.get(`${CacheKeys.SYSTEM_TURNSTILE_PREFIX}${ip}`);
    return val === '1';
}

/**
 * 标记指定 IP 需要人机验证
 * @param {string} ip - 客户端 IP
 */
async function setNeedVerification(ip) {
    await redis.set(`${CacheKeys.SYSTEM_TURNSTILE_PREFIX}${ip}`, '1', 'EX', Turnstile.VERIFICATION_TTL);
}

/**
 * 清除指定 IP 的人机验证标记
 * @param {string} ip - 客户端 IP
 */
async function clearVerification(ip) {
    await redis.del(`${CacheKeys.SYSTEM_TURNSTILE_PREFIX}${ip}`);
}

/**
 * 获取客户端 IP
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           'unknown';
}

/**
 * 执行 Turnstile 人机验证
 * @param {string} token - Turnstile token
 * @returns {Promise<{success: boolean, errorCodes?: string[]}>}
 */
async function verifyTurnstileToken(token) {
    if (!turnstileEnabled) {
        return { success: true };
    }

    const response = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        new URLSearchParams({
            secret: secretKey,
            response: token
        }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    if (!response.data.success) {
        return {
            success: false,
            errorCodes: response.data['error-codes'] || ['未知错误']
        };
    }

    return { success: true };
}

async function verifyTurnstile(req, res, next) {
    if (!turnstileEnabled) {
        return next();
    }

    const token = (req.body && req.body.turnstileToken) || req.headers['x-turnstile-token'];
    const ip = getClientIp(req);

    // 检查该 IP 是否需要人机验证
    const needVerification = await isNeedVerification(ip);
    if (needVerification && !token) {
        return res.status(400).json({
            success: false,
            error: '请先完成人机验证',
            needTurnstile: true
        });
    }

    // 如果提供了 turnstileToken，验证人机验证
    if (token) {
        const result = await verifyTurnstileToken(token);

        if (!result.success) {
            return res.status(403).json({
                success: false,
                error: '人机验证失败',
                detail: result.errorCodes,
                needTurnstile: true
            });
        }

        // 验证成功，清除该 IP 的标记
        await clearVerification(ip);
    }

    next();
}

module.exports = Object.assign(asyncHandler(verifyTurnstile), {
    isNeedVerification,
    setNeedVerification,
    clearVerification,
    verifyTurnstileToken,
    getClientIp,
});
