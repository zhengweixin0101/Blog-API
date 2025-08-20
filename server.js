const express = require('express');
const app = express();

const getArticleRoute = require('./api/getArticle');
const getListRoute = require('./api/getList');

app.use('/api/article', getArticleRoute);
app.use('/api/list', getListRoute);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
