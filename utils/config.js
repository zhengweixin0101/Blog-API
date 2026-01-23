/**
 * 配置常量 - 统一管理项目中的各种配置参数
 */

/**
 * 认证相关配置
 */
const Auth = {
    TOKEN_EXPIRY: 3 * 24 * 60 * 60 * 1000, // Token 默认有效期（毫秒），登录和未传 expiresIn 时使用
    TOKEN_LENGTH: 64,                     // Token 长度
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
        MAX: 20,                        // 最大连接数
        MIN: 1,                         // 最小连接数
        IDLE_TIMEOUT_MS: 30000,         // 空闲连接超时（毫秒）
        CONNECTION_TIMEOUT_MS: 10000,  // 连接超时（毫秒）
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

module.exports = {
    Auth,
    Cache,
    Database,
    Pagination,
    App,
};
