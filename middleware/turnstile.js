const axios = require('axios');

const secretKey = process.env.TURNSTILE_SECRET_KEY;
const turnstileEnabled = !!secretKey;

async function verifyTurnstile(req, res, next) {
    if (!turnstileEnabled) {
        return next();
    }

    const token = req.body.turnstileToken || req.headers['x-turnstile-token'];

    if (!token) {
        return res.status(400).json({ error: '缺少 Turnstile 验证令牌' });
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
            return res.status(403).json({
                error: '验证失败',
                detail: response.data['error-codes'] || '未知错误'
            });
        }

        next();
    } catch (error) {
        console.error('Turnstile 验证请求失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
        return res.status(500).json({ error: '验证服务不可用' });
    }
}

module.exports = verifyTurnstile;
