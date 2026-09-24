const db = require('../db');
const { CacheKeys } = require('./constants');
const { Cache } = require('./config');
const redis = db.redis;

/**
 * 执行删除，失败自动重试一次
 * @param {Function} fn - 删除操作
 * @param {string} context - 错误日志上下文
 */
async function deleteWithRetry(fn, context) {
    try {
        await fn();
    } catch (err) {
        console.error(`${context}，正在重试：`, err);
        try {
            await fn();
        } catch (retryErr) {
            console.error(`⚠️ ${context}，重试仍失败，请检查 Redis 状态：`, retryErr);
        }
    }
}

/**
 * 延迟二次删除
 * fire-and-forget，不阻塞接口响应
 * @param {Function} fn - 删除操作
 * @param {string} context - 错误日志上下文
 */
function scheduleDoubleDelete(fn, context) {
    setTimeout(() => {
        fn().catch(err => {
            console.error(`⚠️ ${context}（延迟双删），请检查 Redis 状态：`, err);
        });
    }, Cache.DOUBLE_DELETE_DELAY);
}

/**
 * 清除所有文章列表相关的缓存
 * 匹配模式：posts:list*
 */
async function clearPostListCache() {
    const clear = async () => {
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
    };

    await deleteWithRetry(clear, '清除文章列表缓存时出错');
    scheduleDoubleDelete(clear, '清除文章列表缓存时出错');
}

/**
 * 清除指定文章的缓存
 * @param {string} slug - 文章的 slug
 */
async function clearPostCache(slug) {
    if (!slug) return;

    const clear = async () => {
        await Promise.all([
            redis.del(CacheKeys.postDetailKey(slug, false)),
            redis.del(CacheKeys.postDetailKey(slug, true))
        ]);
    };

    await deleteWithRetry(clear, `清除文章 [${slug}] 缓存时出错`);
    scheduleDoubleDelete(clear, `清除文章 [${slug}] 缓存时出错`);
}

/**
 * 清除所有说说相关的缓存
 * 匹配模式：talks:*
 */
async function clearTalksCache() {
    const clear = async () => {
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
    };

    await deleteWithRetry(clear, '清除说说缓存时出错');
    scheduleDoubleDelete(clear, '清除说说缓存时出错');
}

module.exports = {
    clearPostListCache,
    clearPostCache,
    clearTalksCache
};
