/**
 * 缓存键常量 - 统一管理 Redis 缓存键
 */

const CacheKeys = {
    // 文章相关缓存键
    POST_LIST: 'post:list',
    POST_LIST_ALL: 'post:list:all',
    POST_LIST_FIELDS_PREFIX: 'post:list:fields:',
    POST_PREFIX: 'post:',
    POST_HTML_PREFIX: 'post:html:',

    // 说说相关缓存键
    TALKS_PREFIX: 'talks:',

    // 缓存匹配模式（用于 SCAN 命令）
    POSTS_PATTERN: 'post:*',
    TALKS_PATTERN: 'talks:*',

    /**
     * 生成文章列表缓存键
     * @param {boolean} all - 是否包含未发布文章
     * @param {string[]} fields - 请求的字段
     * @param {number} page - 页码（可选）
     * @param {number} pageSize - 每页数量（可选）
     * @returns {string} 缓存键
     */
    postListKey: (all = false, fields = null, page = null, pageSize = null) => {
        let key = '';
        if (fields && fields.length > 0) {
            key = `post:list:fields:${fields.join(',')}${all ? ':all' : ''}`;
        } else {
            key = all ? CacheKeys.POST_LIST_ALL : CacheKeys.POST_LIST;
        }

        if (page && pageSize) {
            key += `:${page}:${pageSize}`;
        }

        return key;
    },

    /**
     * 生成文章详情缓存键
     * @param {string} slug - 文章 slug
     * @param {boolean} isHtml - 是否为 HTML 格式
     * @returns {string} 缓存键
     */
    postDetailKey: (slug, isHtml = false) => {
        return isHtml ? `post:html:${slug}` : `post:${slug}`;
    },

    /**
     * 生成说说列表缓存键
     * @param {number} page - 页码（可选）
     * @param {number} pageSize - 每页数量（可选）
     * @param {string} tag - 标签筛选（可选）
     * @param {string} sort - 排序方式（可选）
     * @returns {string} 缓存键
     */
    talksListKey: (page = null, pageSize = null, tag = null, sort = null) => {
        let key = 'talks:list';

        // 标签或all标识
        key += tag ? `:${tag}` : ':all';

        // 分页参数（可选）
        if (page && pageSize) {
            key += `:${pageSize}:${page}`;
        }

        // 排序方式（非desc时才添加）
        if (sort && sort.toLowerCase() !== 'desc') {
            key += `:${sort}`;
        }

        return key;
    }
};

/**
 * 数据库索引常量
 */
const DBIndexes = {
    // articles 表索引
    ARTICLES_SLUG: 'idx_articles_slug',
    ARTICLES_PUBLISHED_DATE: 'idx_articles_published_date',

    // admin 表索引
    ADMIN_TOKEN: 'idx_admin_token'
};

module.exports = {
    CacheKeys,
    DBIndexes
};
