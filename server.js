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
const { validate, loginSchema, articleSchema, editArticleSchema, deleteArticleSchema, editSlugSchema, talkSchema, editTalkSchema, deleteTalkSchema, updateAccountSchema, deleteTokenSchema, createTokenSchema, setConfigSchema, getConfigSchema } = require('./middleware/validate');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requirePermission, requireValidToken } = require('./middleware/permission');

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

const setConfigRoute = require('./api/config/set');
const getConfigRoute = require('./api/config/get');

app.use('/api/system/login', validate(loginSchema), verifyTurnstile, loginRoute);
app.use('/api/system/updateAccount', verifyAuth, requirePermission('super'), validate(updateAccountSchema), verifyTurnstile, updateAccountRoute);

app.use('/api/tokens/list', verifyAuth, requirePermission('super'), verifyTurnstile, listTokensRoute);
app.use('/api/tokens/create', verifyAuth, requirePermission('super'), validate(createTokenSchema), verifyTurnstile, createTokenRoute);
app.use('/api/tokens/delete', verifyAuth, requirePermission('super'), validate(deleteTokenSchema), verifyTurnstile, deleteTokenRoute);

app.use('/api/article/get', getArticleRoute);
app.use('/api/article/list', getListRoute);
app.use('/api/article/all', requireValidToken, verifyTurnstile, getAllRoute);
app.use('/api/article/add', verifyAuth, requirePermission('article:write'), validate(articleSchema), verifyTurnstile, addArticleRoute);
app.use('/api/article/edit', verifyAuth, requirePermission('article:write'), validate(editArticleSchema), verifyTurnstile, editArticleRoute);
app.use('/api/article/delete', verifyAuth, requirePermission('article:delete'), validate(deleteArticleSchema), verifyTurnstile, deleteArticleRoute);
app.use('/api/article/edit-slug', verifyAuth, requirePermission('article:write'), validate(editSlugSchema), verifyTurnstile, editSlugRoute);

app.use('/api/talks/get', getTalksRoute);
app.use('/api/talks/edit', verifyAuth, requirePermission('talk:write'), validate(editTalkSchema), verifyTurnstile, editTalkRoute);
app.use('/api/talks/add', verifyAuth, requirePermission('talk:write'), validate(talkSchema), verifyTurnstile, addTalkRoute);
app.use('/api/talks/delete', verifyAuth, requirePermission('talk:delete'), validate(deleteTalkSchema), verifyTurnstile, deleteTalkRoute);

app.use('/api/config/set', verifyAuth, requirePermission('super'), validate(setConfigSchema), verifyTurnstile, setConfigRoute);
app.use('/api/config/get', verifyAuth, requirePermission('super'), validate(getConfigSchema), verifyTurnstile, getConfigRoute);

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