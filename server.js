require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 读取密钥
const API_SECRET = process.env.API_SECRET;

// 简单验证中间件
function verifySecret(req, res, next) {
    const secret = req.headers['x-api-key']; // 前端传 x-api-key
    if (!secret || secret !== API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
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
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));