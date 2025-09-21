const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function init() {
    const createTableQuery = `
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
    await pool.query(createTableQuery);
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    init
};