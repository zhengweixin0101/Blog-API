const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());  // <--- 解析 JSON 请求体
app.use(express.urlencoded({ extended: true })); // 可选，解析 URL-encoded

const getArticleRoute = require('./api/getArticle');
const getListRoute = require('./api/getList');
const editArticleRoute = require('./api/editArticle');

app.use('/api/article', getArticleRoute);
app.use('/api/list', getListRoute);
app.use('/api/edit', editArticleRoute);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));