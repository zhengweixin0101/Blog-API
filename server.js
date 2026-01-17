require('dotenv').config();

const db = require('./db.js');
const express = require('express');
const cors = require('cors');
const app = express();

// 验证环境变量
const requiredEnvVars = ['DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error(`❌ 缺少必需的环境变量: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8000;

// 中间件
const verifyAuth = require('./middleware/auth');
const verifyTurnstile = require('./middleware/turnstile');

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

const loginRoute = require('./api/system/login');

app.use('/api/system/login', verifyTurnstile, loginRoute);

app.use('/api/article/get', getArticleRoute);
app.use('/api/article/list', getListRoute);
app.use('/api/article/all', verifyAuth, getAllRoute);
app.use('/api/article/add', verifyAuth, verifyTurnstile, addArticleRoute);
app.use('/api/article/edit', verifyAuth, verifyTurnstile, editArticleRoute);
app.use('/api/article/delete', verifyAuth, verifyTurnstile, deleteArticleRoute);
app.use('/api/article/edit-slug', verifyAuth, verifyTurnstile, editSlugRoute);

app.use('/api/talks/get', getTalksRoute);
app.use('/api/talks/edit', verifyAuth, verifyTurnstile, editTalkRoute);
app.use('/api/talks/add', verifyAuth, verifyTurnstile, addTalkRoute);
app.use('/api/talks/delete', verifyAuth, verifyTurnstile, deleteTalkRoute);

// 404处理
app.use((_req, res) => {
    res.status(404).json({ error: '不存在' });
});

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