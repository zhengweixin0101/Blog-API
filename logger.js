const axios = require('axios');
const db = require('./db');
const { CacheKeys } = require('./utils/constants');

/**
 * 获取客户端IP地址
 * @param {Object} req - 请求对象
 * @returns {string} IP地址
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
 * 从请求中获取认证token信息
 * @param {Object} req - 请求对象
 * @returns {Object|null} Token信息 {name} 或 null
 */
function getAuthToken(req) {
    // 如果请求已通过认证，从 req.user 获取 token 信息
    if (req.user && req.user.tokenName) {
        return {
            name: req.user.tokenName
        };
    }

    return null;
}

/**
 * 获取IP地理位置信息
 * @param {string} ip - IP地址
 * @returns {Promise<string>} 地理位置
 */
async function getLocation(ip) {
    if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
        return '本地';
    }

    // 检查 Redis 缓存
    try {
        const locations = await db.redis.hgetall(CacheKeys.LOCATIONS_KEY);
        if (locations && locations[ip]) {
            return locations[ip];
        }
    } catch (error) {
        console.warn('Redis 缓存读取失败:', error.message);
    }

    // 尝试多个IP定位服务
    const providers = [
        {
            name: 'ip9.com.cn',
            url: `https://ip9.com.cn/get?ip=${ip}`,
            parse: (data) => {
                if (data.ret === 200 && data.data) {
                    const d = data.data;
                    return `${d.country || ''} ${d.prov || ''} ${d.city || ''} ${d.isp || ''}`.trim();
                }
                return null;
            }
        },
        {
            name: 'whois.pconline',
            url: `https://whois.pconline.com.cn/ip.jsp?ip=${ip}`,
            parse: (data) => {
                return data.trim() || null;
            }
        },
        {
            name: 'ip.taobao',
            url: `https://ip.taobao.com/outGetIpInfo?ip=${ip}&accessKey=alibaba-inc`,
            parse: (data) => {
                if (data.code === 0 && data.data) {
                    const d = data.data;
                    if (d.country === '中国') {
                        // 中国IP显示省份+运营商
                        return `${d.region || ''} ${d.city || ''} ${d.isp || ''}`.trim();
                    } else {
                        // 国外IP显示国家
                        return d.country || '未知';
                    }
                }
                return null;
            }
        }
    ];

    for (const provider of providers) {
        try {
            const response = await axios.get(provider.url, {
                timeout: 2000
            });
            const location = provider.parse(response.data);
            if (location) {
                // 更新 Redis 缓存（使用 Hash，整个列表缓存30天）
                try {
                    await db.redis.hset(CacheKeys.LOCATIONS_KEY, ip, location);
                    await db.redis.expire(CacheKeys.LOCATIONS_KEY, 30 * 24 * 60 * 60);
                } catch (error) {
                    console.warn('Redis 缓存写入失败:', error.message);
                }

                return location;
            }
        } catch (error) {
            console.warn(`IP定位失败 (${provider.name}):`, error.message);
        }
    }

    return '未知';
}

/**
 * 解析User-Agent获取浏览器信息
 * @param {string} userAgent - User-Agent字符串
 * @returns {string} 浏览器信息
 */
function parseBrowser(userAgent) {
    if (!userAgent) return 'unknown';

    let browser = 'unknown';
    if (userAgent.includes('Edg/')) {
        browser = 'Edge ' + userAgent.match(/Edg\/([\d.]+)/)?.[1];
    } else if (userAgent.includes('Chrome/')) {
        browser = 'Chrome ' + userAgent.match(/Chrome\/([\d.]+)/)?.[1];
    } else if (userAgent.includes('Firefox/')) {
        browser = 'Firefox ' + userAgent.match(/Firefox\/([\d.]+)/)?.[1];
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
        browser = 'Safari ' + userAgent.match(/Version\/([\d.]+)/)?.[1];
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
        browser = 'IE';
    }

    return browser;
}

/**
 * 判断是否为公开的GET操作
 * @param {string} method - 请求方法
 * @param {string} path - 请求路径
 * @returns {boolean}
 */
function isPublicGetOperation(method, path) {
    // GET请求且路径不包含 /api/system、/api/logs
    return method === 'GET' &&
           !path.startsWith('/api/system') &&
           !path.startsWith('/api/logs');
}

/**
 * 获取日志过期时间（秒）
 * @param {string} method - 请求方法
 * @param {string} path - 请求路径
 * @returns {number} 过期时间（秒）
 */
function getLogExpiry(method, path) {
    // 公开的GET操作：7天
    if (isPublicGetOperation(method, path)) {
        return 7 * 24 * 60 * 60; // 7天
    }
    // 其他系统操作：30天
    return 30 * 24 * 60 * 60; // 30天
}

/**
 * 记录操作日志
 * @param {Object} options - 日志选项
 * @param {string} options.action - 操作名称
 * @param {string} options.ip - IP地址（可选，会自动从req获取）
 * @param {string} options.location - 地理位置（可选，会自动获取）
 * @param {string} options.userAgent - User-Agent（可选，会自动从req获取）
 * @param {Object} options.req - 请求对象（提供后自动获取IP和User-Agent）
 * @param {string} options.method - 请求方法
 * @param {string} options.path - 请求路径
 * @param {number} options.status - 响应状态码
 * @param {string} options.userId - 用户ID（可选）
 */
const logger = {
/**
 * 记录日志到Redis
 * @param {string} action - 操作名称
 * @param {string} ip - IP地址
 * @param {string} location - 地理位置
 * @param {string} userAgent - User-Agent
 * @param {string} method - 请求方法
 * @param {string} path - 请求路径
 * @param {number} status - 状态码
 * @param {string} userId - 用户ID（可选）
 */
log: async (action, ip, location, userAgent, method, path, status, tokenInfo = null) => {
    try {
        // 使用时间戳作为 Sorted Set 的 score
        const score = Date.now();
        const logId = Math.random().toString(36).slice(2, 15);
        const logData = {
            id: logId,
            action,
            ip,
            location,
            user_agent: userAgent,
            method,
            path,
            status,
            token_name: tokenInfo?.name || null,
            created_at: new Date(score).toISOString()
        };

        // 计算过期时间
        const expiry = getLogExpiry(method, path);

        // 存储到 Sorted Set
        await db.redis.zadd(CacheKeys.LOGS_LIST_KEY, score, JSON.stringify(logData));

        // 设置 Sorted Set 过期时间（30天）
        await db.redis.expire(CacheKeys.LOGS_LIST_KEY, 30 * 24 * 60 * 60);

        return logId;
    } catch (error) {
        console.error('日志记录失败:', error);
    }
},

    /**
     * 从请求对象记录日志
     * @param {Object} req - 请求对象
     * @param {string} action - 操作名称
     * @param {number} status - 状态码
     * @param {Object} tokenInfo - Token信息（可选）
     */
    logFromRequest: async (req, action, status, tokenInfo = null) => {
        const ip = getClientIp(req);
        const location = await getLocation(ip);
        const userAgent = req.headers['user-agent'] || 'unknown';
        // 使用 originalUrl 获取完整路径（包含查询参数）
        const path = req.originalUrl || req.path;
        // 如果没有传入 tokenInfo，从请求头获取
        const authToken = tokenInfo || getAuthToken(req);

        return logger.log(
            action,
            ip,
            location,
            userAgent,
            req.method,
            path,
            status,
            authToken
        );
    },

    /**
     * 获取客户端IP地址
     */
    getClientIp,

    /**
     * 获取IP地理位置信息
     */
    getLocation,

    /**
     * 解析User-Agent获取浏览器信息
     */
    parseBrowser
};

module.exports = logger;
