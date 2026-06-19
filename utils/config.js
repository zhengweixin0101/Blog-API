/**
 * 配置常量 - 统一管理项目中的各种配置参数
 */

/**
 * 认证相关配置
 */
const Auth = {
    TOKEN_EXPIRY: 3 * 24 * 60 * 60 * 1000, // Token 默认有效期（毫秒），登录和未传 expiresIn 时使用
    TOKEN_EXPIRY_CUSTOM: 24 * 60 * 60 * 1000, // 自定义 Token 默认有效期（毫秒）
    TOKEN_LENGTH: 32,                     // Token 长度
    TOKEN_TTL_MIN: 60,                    // Token Redis 最小 TTL（秒）
    BCRYPT_SALT_ROUNDS: 10,              // bcrypt 盐轮数
};

/**
 * 缓存相关配置
 */
const Cache = {
    TTL: {
        // 缓存过期时间（秒）
        POST_LIST: 30 * 24 * 60 * 60,      // 文章列表
        POST_DETAIL: 30 * 24 * 60 * 60,   // 文章详情
        TALKS_LIST: 30 * 24 * 60 * 60,    // 说说列表
    },
    SCAN_COUNT: 100,      // Redis SCAN 每次返回数量
    DELETE_BATCH_SIZE: 50, // Redis 批量删除大小
};

/**
 * 数据库相关配置
 */
const Database = {
    // 连接池配置
    POOL: {
        MAX: 50,                         // 最大连接数
        MIN: 5,                          // 最小连接数
        IDLE_TIMEOUT_MS: 30000,         // 空闲连接超时（毫秒）
        CONNECTION_TIMEOUT_MS: 10000,  // 连接超时（毫秒）
        KEEPALIVE_INITIAL_DELAY_MS: 10000, // keepAlive 初始延迟（毫秒）
    },
};

/**
 * 分页配置
 */
const Pagination = {
    DEFAULT_PAGE: 1,       // 默认页码
    DEFAULT_PAGE_SIZE: 10, // 默认每页数量
    MAX_PAGE_SIZE: 100,    // 最大每页数量
};

/**
 * 应用配置
 */
const App = {
    PORT: 8000,            // 默认端口
    SHUTDOWN_TIMEOUT: 10000, // 关闭超时（毫秒）
};

/**
 * 速率限制配置
 */
const RateLimit = {
    WINDOW_MS: 60 * 1000,  // 时间窗口（毫秒），默认 1 分钟
    MAX: 3,                // 时间窗口内最大请求数
};

/**
 * 日志配置
 */
const Log = {
    SYSTEM_EXPIRY: 30 * 24 * 60 * 60,       // 日志保留时间（秒），30 天
    LOCATION_EXPIRY: 30 * 24 * 60 * 60,     // IP 定位缓存过期时间（秒），30 天
};

/**
 * Turnstile 人机验证配置
 */
const Turnstile = {
    VERIFICATION_TTL: 600, // 验证标记过期时间（秒），5 分钟
};

module.exports = {
    Auth,
    Cache,
    Database,
    Pagination,
    App,
    RateLimit,
    Log,
    Turnstile,
};
