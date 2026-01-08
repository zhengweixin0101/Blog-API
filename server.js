require('dotenv').config();

const db = require('./db.js');
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8000;

async function verifyAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: '未提供认证信息' });
    }

    // 支持不同大小写的 Bearer 前缀，并安全地提取 token
    let token = authHeader;
    if (/^Bearer\s+/i.test(authHeader)) {
        token = authHeader.replace(/^Bearer\s+/i, '');
    }

    const result = await db.query(
        'SELECT id, username, token, token_expires_at FROM admin WHERE token = $1',
        [token]
    );

    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'token无效' });
    }

    const admin = result.rows[0];

    // 处理可能为 null/undefined/字符串/Date 的过期字段
    const expiresAt = admin.token_expires_at ? new Date(admin.token_expires_at) : null;
    if (!expiresAt || isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        return res.status(401).json({ error: 'token已过期' });
    }

    req.user = { id: admin.id, username: admin.username };
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

const loginRoute = require('./api/system/login');

app.use('/api/system/login', loginRoute);

app.use('/api/article/get', getArticleRoute);
app.use('/api/article/list', getListRoute);
app.use('/api/article/all', verifyAuth, getAllRoute);
app.use('/api/article/add', verifyAuth, addArticleRoute);
app.use('/api/article/edit', verifyAuth, editArticleRoute);
app.use('/api/article/delete', verifyAuth, deleteArticleRoute);
app.use('/api/article/edit-slug', verifyAuth, editSlugRoute);

app.use('/api/talks/get', getTalksRoute);
app.use('/api/talks/edit', verifyAuth, editTalkRoute);
app.use('/api/talks/add', verifyAuth, addTalkRoute);
app.use('/api/talks/delete', verifyAuth, deleteTalkRoute);

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