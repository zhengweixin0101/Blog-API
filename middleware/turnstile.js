const axios = require('axios');

const secretKey = process.env.TURNSTILE_SECRET_KEY;
const turnstileEnabled = !!secretKey;

// 验证失败标记
let needVerification = false;

/**
 * 检查是否需要人机验证
 * @returns {boolean}
 */
function isNeedVerification() {
    return needVerification;
}

/**
 * 设置人机验证标记
 * @param {boolean} value
 */
function setNeedVerification(value) {
    needVerification = value;
}

/**
 * 清除人机验证标记
 */
function clearVerification() {
    needVerification = false;
}

/**
 * 检查是否需要提示用户进行验证（不直接返回响应）
 * @param {string} providedToken - 提供的验证令牌
 * @returns {boolean} 是否需要验证
 */
function shouldRequireVerification(providedToken) {
    return needVerification && !providedToken;
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

    try {
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

        // 验证成功，清除标记
        clearVerification();
        return { success: true };
    } catch (error) {
        console.error('Turnstile 验证请求失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
        return {
            success: false,
            errorCodes: ['验证服务不可用']
        };
    }
}

async function verifyTurnstile(req, res, next) {
    if (!turnstileEnabled) {
        return next();
    }

    const token = req.body.turnstileToken || req.headers['x-turnstile-token'];

    // 如果标记需要验证，但没有提供 turnstileToken，要求验证
    if (shouldRequireVerification(token)) {
        return res.status(400).json({
            error: '请完成人机验证',
            needTurnstile: true
        });
    }

    // 如果提供了 turnstileToken，先验证人机验证是否通过
    if (token) {
        const result = await verifyTurnstileToken(token);

        if (!result.success) {
            return res.status(403).json({
                error: '人机验证失败',
                detail: result.errorCodes,
                needTurnstile: true
            });
        }
    }

    // 首次访问或标记已清除，直接放行
    next();
}

module.exports = verifyTurnstile;
module.exports.isNeedVerification = isNeedVerification;
module.exports.setNeedVerification = setNeedVerification;
module.exports.clearVerification = clearVerification;
module.exports.shouldRequireVerification = shouldRequireVerification;
module.exports.verifyTurnstileToken = verifyTurnstileToken;