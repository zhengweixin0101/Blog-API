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
const articleRoute = require('./api/articles');
const talksRoute = require('./api/talks');
const loginRoute = require('./api/system/login');
const updateAccountRoute = require('./api/system/updateAccount');
const tokensRoute = require('./api/system/tokens');
const configRoute = require('./api/system/config');
  
app.use('/api/system/login', validate(loginSchema), verifyTurnstile, loginRoute);
app.use('/api/system/updateAccount', verifyAuth, requirePermission('super'), validate(updateAccountSchema), verifyTurnstile, updateAccountRoute);

app.use('/api/system/tokens', verifyAuth, requirePermission('super'), (req, res, next) => {
    if (req.method === 'GET') {
        return next();
    }
    
    if (req.method === 'POST') {
        return validate(createTokenSchema)(req, res, next);
    }
    
    if (req.method === 'DELETE') {
        return validate(deleteTokenSchema)(req, res, next);
    }
    
    next();
}, verifyTurnstile, tokensRoute);

app.use('/api/system/config', verifyAuth, requirePermission('super'), (req, res, next) => {
    if (req.method === 'POST') {
        return validate(setConfigSchema)(req, res, next);
    }
    
    if (req.method === 'GET') {
        return validate(getConfigSchema)(req, res, next);
    }
    
    next();
}, verifyTurnstile, configRoute);

app.use('/api/articles', (req, res, next) => {
    if (req.method === 'GET') {
        return next();
    }
    
    verifyAuth(req, res, () => {
        if (req.method === 'POST') {
            requirePermission('article:write')(req, res, () => {
                validate(articleSchema)(req, res, next);
            });
        } else if (req.method === 'PUT') {
            requirePermission('article:write')(req, res, () => {
                validate(editArticleSchema)(req, res, next);
            });
        } else if (req.method === 'PATCH') {
            requirePermission('article:write')(req, res, () => {
                validate(editSlugSchema)(req, res, next);
            });
        } else if (req.method === 'DELETE') {
            requirePermission('article:delete')(req, res, () => {
                validate(deleteArticleSchema)(req, res, next);
            });
        } else {
            next();
        }
    });
}, verifyTurnstile, articleRoute);

app.use('/api/talks', (req, res, next) => {
    if (req.method === 'GET') {
        return next();
    }

    verifyAuth(req, res, () => {
        requirePermission('talk:write')(req, res, () => {
            if (req.method === 'POST') {
                return validate(talkSchema)(req, res, next);
            }

            if (req.method === 'PUT') {
                return validate(editTalkSchema)(req, res, next);
            }

            if (req.method === 'DELETE') {
                return validate(deleteTalkSchema)(req, res, next);
            }

            next();
        });
    });
}, verifyTurnstile, talksRoute);

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