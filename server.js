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

const { App } = require('./utils/config');
const PORT = process.env.PORT || App.PORT;

// 中间件
const verifyAuth = require('./middleware/auth');
const verifyTurnstile = require('./middleware/turnstile');
const { validate, loginSchema, articleSchema, editArticleSchema, deleteArticleSchema, editSlugSchema, talkSchema, editTalkSchema, deleteTalkSchema, updateAccountSchema } = require('./middleware/validate');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

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
const updateAccountRoute = require('./api/system/updateAccount');

const listTokensRoute = require('./api/tokens/list');
const createTokenRoute = require('./api/tokens/create');
const deleteTokenRoute = require('./api/tokens/delete');
const toggleTokenRoute = require('./api/tokens/toggle');

app.use('/api/system/login', validate(loginSchema), verifyTurnstile, loginRoute);
app.use('/api/system/updateAccount', verifyAuth, validate(updateAccountSchema), updateAccountRoute);

app.use('/api/tokens/list', verifyAuth, listTokensRoute);
app.use('/api/tokens/create', verifyAuth, createTokenRoute);
app.use('/api/tokens/delete', verifyAuth, deleteTokenRoute);
app.use('/api/tokens/toggle', verifyAuth, toggleTokenRoute);

app.use('/api/article/get', getArticleRoute);
app.use('/api/article/list', getListRoute);
app.use('/api/article/all', verifyAuth, verifyTurnstile, getAllRoute);
app.use('/api/article/add', verifyAuth, validate(articleSchema), verifyTurnstile, addArticleRoute);
app.use('/api/article/edit', verifyAuth, validate(editArticleSchema), verifyTurnstile, editArticleRoute);
app.use('/api/article/delete', verifyAuth, validate(deleteArticleSchema), verifyTurnstile, deleteArticleRoute);
app.use('/api/article/edit-slug', verifyAuth, validate(editSlugSchema), verifyTurnstile, editSlugRoute);

app.use('/api/talks/get', getTalksRoute);
app.use('/api/talks/edit', verifyAuth, validate(editTalkSchema), verifyTurnstile, editTalkRoute);
app.use('/api/talks/add', verifyAuth, validate(talkSchema), verifyTurnstile, addTalkRoute);
app.use('/api/talks/delete', verifyAuth, validate(deleteTalkSchema), verifyTurnstile, deleteTalkRoute);

// 404 处理
app.use(notFoundHandler);

// 全局错误处理（必须放在最后）
app.use(errorHandler);

// 启动
(async () => {
    try {
        await db.init(); // 初始化数据库
        const server = app.listen(PORT, () => console.log(`🚀 服务运行在 http://localhost:${PORT}/`));

        // 优雅关闭处理
        const gracefulShutdown = async (signal) => {
            console.log(`\n⚠️  收到 ${signal} 信号，开始关闭服务...`);

            // 停止接受新连接
            server.close(async (err) => {
                if (err) {
                    console.error('❌ 关闭 HTTP 服务器失败:', err);
                    process.exit(1);
                }

                try {
                    // 关闭数据库连接
                    await db.close();
                    console.log('✅ 所有连接已关闭，服务停止');
                    process.exit(0);
                } catch (closeErr) {
                    console.error('❌ 关闭数据库连接失败:', closeErr);
                    process.exit(1);
                }
            });

            // 如果超时内未完成关闭，强制退出
            setTimeout(() => {
                console.error('❌ 关闭超时，强制退出');
                process.exit(1);
            }, App.SHUTDOWN_TIMEOUT);
        };

        // 监听退出信号
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (err) {
        console.error("❌ 数据库初始化失败：", err);
        process.exit(1);
    }
})();