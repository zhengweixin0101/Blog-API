const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();
const { DBIndexes } = require('./utils/constants');
const { Database, Cache } = require('./utils/config');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: Database.POOL.MAX,
    min: Database.POOL.MIN,
    idleTimeoutMillis: Database.POOL.IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: Database.POOL.CONNECTION_TIMEOUT_MS,
    // 保持连接活跃
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL error:', err);
});

let redis = new Redis(process.env.REDIS_URL);
redis.on('connect', () => console.log('✅ Redis 连接成功'));
redis.on('error', (err) => console.error('❌ Redis error:', err));

/**
 * 关闭数据库连接
 * @returns {Promise<void>}
 */
async function close() {
    try {
        // 关闭 PostgreSQL 连接池
        await pool.end();
        console.log('✅ PostgreSQL 连接已关闭');

        // 关闭 Redis 连接
        await redis.quit();
        console.log('✅ Redis 连接已关闭');
    } catch (err) {
        console.error('❌ 关闭数据库连接时出错:', err);
        throw err;
    }
}

const { CacheKeys } = require('./utils/constants');

async function init() {
    console.log('✅ PostgreSQL 连接成功');

    // 清除文章缓存
    let cursor = '0';
    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', CacheKeys.POSTS_PATTERN, 'COUNT', Cache.SCAN_COUNT);
        cursor = nextCursor;
        if (keys.length > 0) {
            await redis.del(keys);
        }
    } while (cursor !== '0');

    // 清除说说缓存
    cursor = '0';
    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', CacheKeys.TALKS_PATTERN, 'COUNT', Cache.SCAN_COUNT);
        cursor = nextCursor;
        if (keys.length > 0) {
            await redis.del(keys);
        }
    } while (cursor !== '0');
    console.log('🧹 缓存已清除');

    const checkTablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('articles', 'talks', 'configs');
    `;
    const result = await pool.query(checkTablesQuery);
    const existingTables = result.rows.map(r => r.table_name);

    const createArticlesTableQuery = `
        CREATE TABLE IF NOT EXISTS articles (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            description TEXT,
            tags TEXT[],
            content TEXT,
            published BOOLEAN DEFAULT false,
            date DATE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS ${DBIndexes.ARTICLES_SLUG} ON articles(slug);
        CREATE INDEX IF NOT EXISTS ${DBIndexes.ARTICLES_PUBLISHED_DATE} ON articles(published, date DESC);
    `;

    const createMemosTableQuery = `
        CREATE TABLE IF NOT EXISTS talks (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            location TEXT,
            links JSONB DEFAULT '[]'::JSONB,
            imgs JSONB DEFAULT '[]'::JSONB,
            tags TEXT[] DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS ${DBIndexes.TALKS_CREATED_AT} ON talks(created_at DESC);
        CREATE INDEX IF NOT EXISTS ${DBIndexes.TALKS_TAGS} ON talks USING GIN(tags);
    `;

    const createAdminTableQuery = `
        CREATE TABLE IF NOT EXISTS configs (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL DEFAULT '{}'::jsonb,
            description TEXT,
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS ${DBIndexes.CONFIGS_UPDATED_AT} ON configs(updated_at DESC);
    `;

    const newlyCreated = [];

    if (!existingTables.includes('articles')) {
        await pool.query(createArticlesTableQuery);
        newlyCreated.push('articles');
    }

    if (!existingTables.includes('talks')) {
        await pool.query(createMemosTableQuery);
        newlyCreated.push('talks');
    }

    if (!existingTables.includes('configs')) {
        await pool.query(createAdminTableQuery);
        newlyCreated.push('configs');
    }

    if (newlyCreated.length > 0) {
        console.log(`✅ 数据库未初始化，已自动创建表格：${newlyCreated.join(', ')}`);
    } else {
        console.log('✅ 数据库表格已存在，跳过初始化');
    }
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    init,
    redis,
    close
};