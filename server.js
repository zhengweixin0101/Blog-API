const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const getArticleRoute = require('./api/getArticle');
const getListRoute = require('./api/getList');
const editArticleRoute = require('./api/editArticle');
const deleteArticleRoute = require('./api/deleteArticle');

app.use('/api/article', getArticleRoute);
app.use('/api/list', getListRoute);
app.use('/api/edit', editArticleRoute);
app.use('/api/delete', deleteArticleRoute);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));