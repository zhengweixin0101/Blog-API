const db = require('../db');
const { CacheKeys } = require('./constants');
const { Cache } = require('./config');
const redis = db.redis;

/**
 * 清除所有文章列表相关的缓存
 * 匹配模式：post:list*
 */
async function clearPostListCache() {
    if (!redis) return;

    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${CacheKeys.POST_LIST}*`, 'COUNT', Cache.SCAN_COUNT);
            cursor = nextCursor;
            if (keys.length > 0) {
                for (let i = 0; i < keys.length; i += Cache.DELETE_BATCH_SIZE) {
                    await redis.del(...keys.slice(i, i + Cache.DELETE_BATCH_SIZE));
                }
            }
        } while (cursor !== '0');
    } catch (err) {
        console.error('清除文章列表缓存时出错：', err);
    }
}

/**
 * 清除指定文章的缓存
 * @param {string} slug - 文章的 slug
 */
async function clearPostCache(slug) {
    if (!redis || !slug) return;

    try {
        await Promise.all([
            redis.del(CacheKeys.postDetailKey(slug, false)),
            redis.del(CacheKeys.postDetailKey(slug, true))
        ]);
    } catch (err) {
        console.error(`清除文章 [${slug}] 缓存时出错：`, err);
    }
}

/**
 * 清除所有说说相关的缓存
 * 匹配模式：talks:*
 */
async function clearTalksCache() {
    if (!redis) return;

    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', CacheKeys.TALKS_PATTERN, 'COUNT', Cache.SCAN_COUNT);
            cursor = nextCursor;
            if (keys.length > 0) {
                for (let i = 0; i < keys.length; i += Cache.DELETE_BATCH_SIZE) {
                    await redis.del(...keys.slice(i, i + Cache.DELETE_BATCH_SIZE));
                }
            }
        } while (cursor !== '0');
    } catch (err) {
        console.error('清除说说缓存时出错：', err);
    }
}

module.exports = {
    clearPostListCache,
    clearPostCache,
    clearTalksCache
};
