const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function init() {
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
            links JSONB DEFAULT '[]'::JSONB,
            imgs JSONB DEFAULT '[]'::JSONB,
            tags TEXT[] DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW()
        );
    `;

    await pool.query(createArticlesTableQuery);
    await pool.query(createMemosTableQuery);
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    init
};