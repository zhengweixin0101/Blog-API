/**
 * 统一错误处理中间件
 * 捕获所有路由中抛出的错误并返回标准化响应
 */

function errorHandler(err, req, res, next) {
    // 记录错误日志
    console.error('❌ [Error]', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        timestamp: new Date().toISOString()
    });

    // 数据库相关错误
    if (err.code) {
        // PostgreSQL 错误码
        if (err.code === '23505') {
            // 唯一约束违反
            return res.status(409).json({
                error: '数据冲突，记录已存在',
                detail: err.constraint
            });
        }
        if (err.code === '23503') {
            // 外键约束违反
            return res.status(400).json({
                error: '关联数据不存在'
            });
        }
        if (err.code.startsWith('23')) {
            // 其他完整性约束错误
            return res.status(400).json({
                error: '数据验证失败'
            });
        }
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
            // 连接错误
            return res.status(503).json({
                error: '数据库连接失败'
            });
        }
    }

    // Joi 验证错误
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: '请求参数验证失败',
            details: err.details
        });
    }

    // 认证相关错误
    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: '认证失败'
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: '认证已过期'
        });
    }

    // 自定义业务错误
    if (err.status) {
        return res.status(err.status).json({
            error: err.message || '请求失败'
        });
    }

    // 未知错误
    res.status(500).json({
        error: '服务器内部错误'
    });
}

/**
 * 404 错误处理中间件
 */
function notFoundHandler(req, res, next) {
    res.status(404).json({
        error: '资源不存在',
        path: req.path
    });
}

/**
 * 异步路由包装器
 * 自动捕获异步函数中的错误并传递给错误处理中间件
 * @param {Function} fn - 异步路由处理函数
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};
