require('dotenv').config();

const db = require('./db.js');
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8000;

// 读取密钥
const API_SECRET = process.env.API_SECRET;

// 密钥验证
const failedAttempts = {};
const MAX_ATTEMPTS = 3;
const BLOCK_TIME = 10 * 365 * 24 * 60 * 60 * 1000; // 封禁时间

function verifySecret(req, res, next) {
    const secret = req.headers['x-api-key']; // 前端传 x-api-key
    const ip = req.ip;
    // 检查是否被封锁
    if (failedAttempts[ip] && failedAttempts[ip].blockedUntil > Date.now()) {
        return res.status(429).json({ error: 'Too many failed attempts, IP banned for ten years' });
    }
    if (!secret || secret !== API_SECRET) {
        if (!failedAttempts[ip]) {
            failedAttempts[ip] = { count: 1, blockedUntil: 0 };
        } else {
            failedAttempts[ip].count++;
        }
        if (failedAttempts[ip].count >= MAX_ATTEMPTS) {
            failedAttempts[ip].blockedUntil = Date.now() + BLOCK_TIME;
            failedAttempts[ip].count = 0;
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (failedAttempts[ip]) {
        failedAttempts[ip].count = 0;
        failedAttempts[ip].blockedUntil = 0;
    }
    next();
}

// 路由
const getArticleRoute = require('./api/getArticle');
const getListRoute = require('./api/getList');
const deleteArticleRoute = require('./api/deleteArticle');
const addArticleRoute = require('./api/addArticle');
const editArticleRoute = require('./api/editArticle');
const editSlugRoute = require('./api/editSlug');

app.use('/api/article', getArticleRoute);
app.use('/api/list', getListRoute);
app.use('/api/add', verifySecret, addArticleRoute);
app.use('/api/edit', verifySecret, editArticleRoute);
app.use('/api/delete', verifySecret, deleteArticleRoute);
app.use('/api/edit-slug', verifySecret, editSlugRoute);

// 启动
(async () => {
    try {
        await db.init(); // 初始化数据库
        app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}/`));
    } catch (err) {
        console.error("❌ Failed to init database:", err);
        process.exit(1);
    }
})();