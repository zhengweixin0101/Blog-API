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
        return res.status(429).json({ error: '尝试次数过多，您的IP已被封锁十年！' });
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
        return res.status(401).json({ error: '未授权' });
    }
    if (failedAttempts[ip]) {
        failedAttempts[ip].count = 0;
        failedAttempts[ip].blockedUntil = 0;
    }
    next();
}

// 路由
const getArticleRoute = require('./api/article/getArticle');
const getListRoute = require('./api/article/getList');
const getAllRoute = require('./api/article/getAll');
const deleteArticleRoute = require('./api/article/deleteArticle');
const addArticleRoute = require('./api/article/addArticle');
const editArticleRoute = require('./api/article/editArticle');
const editSlugRoute = require('./api/article/editSlug');

const getTalksRoute = require('./api/talks/get');
const editTalkRoute = require('./api/talks/edit');
const addTalkRoute = require('./api/talks/add');
const deleteTalkRoute = require('./api/talks/delete');

app.use('/api/article/get', getArticleRoute);
app.use('/api/article/list', getListRoute);
app.use('/api/article/all', verifySecret, getAllRoute);
app.use('/api/article/add', verifySecret, addArticleRoute);
app.use('/api/article/edit', verifySecret, editArticleRoute);
app.use('/api/article/delete', verifySecret, deleteArticleRoute);
app.use('/api/article/edit-slug', verifySecret, editSlugRoute);

app.use('/api/talks/get', getTalksRoute);
app.use('/api/talks/edit', verifySecret, editTalkRoute);
app.use('/api/talks/add', verifySecret, addTalkRoute);
app.use('/api/talks/delete', verifySecret, deleteTalkRoute);

// 启动
(async () => {
    try {
        await db.init(); // 初始化数据库
        app.listen(PORT, () => console.log(`🚀 服务运行在 http://localhost:${PORT}/`));
    } catch (err) {
        console.error("❌ 数据库初始化失败：", err);
        process.exit(1);
    }
})();