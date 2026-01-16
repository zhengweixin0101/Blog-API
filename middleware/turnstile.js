const axios = require('axios');

const secretKey = process.env.TURNSTILE_SECRET_KEY;
const turnstileEnabled = !!secretKey;

// 验证失败标记
let needVerification = false;

async function verifyTurnstile(req, res, next) {
    if (!turnstileEnabled) {
        return next();
    }

    const token = req.body.turnstileToken || req.headers['x-turnstile-token'];

    // 如果标记需要验证，但没有提供 turnstileToken，要求验证
    if (needVerification && !token) {
        return res.status(400).json({
            error: '请完成人机验证',
            needTurnstile: true
        });
    }

    // 如果提供了 turnstileToken，先验证人机验证是否通过
    if (token) {
        return requireVerification(req, res, next);
    }

    // 首次访问或标记已清除，直接放行
    next();
}

async function requireVerification(req, res, next) {
    const token = req.body.turnstileToken || req.headers['x-turnstile-token'];

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
            // 人机验证失败，保持标记
            return res.status(403).json({
                error: '人机验证失败',
                detail: response.data['error-codes'] || '未知错误',
                needTurnstile: true
            });
        }

        // 人机验证成功，清除标记后继续处理请求
        needVerification = false;
        next();
    } catch (error) {
        console.error('Turnstile 验证请求失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
        return res.status(500).json({ error: '验证服务不可用', needTurnstile: true });
    }
}

module.exports = verifyTurnstile;
module.exports.setNeedVerification = (value) => {
    needVerification = value;
};
module.exports.clearVerification = () => {
    needVerification = false;
};
// 导出检查函数，供其他路由在需要时短路返回
module.exports.isNeedVerification = () => needVerification;