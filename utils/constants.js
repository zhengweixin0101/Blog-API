/**
 * 缓存键常量 - 统一管理 Redis 缓存键
 */

const CacheKeys = {
    // 文章相关缓存键
    POST_LIST: 'posts:list',
    POST_LIST_ALL: 'posts:list:all',
    POST_LIST_FIELDS_PREFIX: 'posts:list:fields:',
    POST_PREFIX: 'posts:',
    POST_HTML_PREFIX: 'posts:html:',

    // 说说相关缓存键
    TALKS_PREFIX: 'talks:',

    // 缓存匹配模式（用于 SCAN 命令）
    POSTS_PATTERN: 'posts:*',
    TALKS_PATTERN: 'talks:*',

    /**
     * 生成文章列表缓存键
     * 格式: posts:list<:fields><:pageSize><:page><:all>
     * @param {boolean} all - 是否包含未发布文章
     * @param {string[]} fields - 请求的字段
     * @param {number} page - 页码
     * @param {number} pageSize - 每页数量
     * @returns {string} 缓存键
     */
    postListKey: (all = false, fields = null, page = null, pageSize = null) => {
        let key = 'posts:list';
        // 字段参数
        if (fields && fields.length > 0) {
            key += `:${fields.join(',')}`;
        }

        // 分页参数
        if (page && pageSize) {
            key += `:${pageSize}:${page}`;
        }

        // all 标识
        if (all) {
            key += ':all';
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
        return isHtml ? `posts:html:${slug}` : `posts:${slug}`;
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

    // talks 表索引
    TALKS_CREATED_AT: 'idx_talks_created_at',
    TALKS_TAGS: 'idx_talks_tags',

    // admin 表索引
    ADMIN_TOKEN: 'idx_admin_token'
};

module.exports = {
    CacheKeys,
    DBIndexes
};
