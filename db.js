const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

let redis = null;
if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on('connect', () => console.log('✅ Redis 连接成功'));
    redis.on('error', (err) => console.error('❌ Redis error:', err));
}

async function init() {
    if (redis) {
        await redis.flushall();
        console.log('🧹 Redis 缓存已清空');
    }

    const checkTablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('articles', 'talks');
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
};