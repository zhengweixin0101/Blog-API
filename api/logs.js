const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { CacheKeys } = require('../utils/constants');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../logger');

const redis = db.redis;

/**
 * GET /api/logs - 获取日志列表
 * Query参数:
 *   - page: 页码（默认1）
 *   - pageSize: 每页数量（默认20）
 *   - action: 操作名称筛选（可选）
 *   - method: 请求方法筛选（可选）
 *   - status: 状态码筛选（可选）
 *   - startDate: 开始日期（可选）
 *   - endDate: 结束日期（可选）
 */
router.get('/', asyncHandler(async (req, res) => {
    const {
        page = 1,
        pageSize = 20,
        action,
        method,
        status,
        startDate,
        endDate
    } = req.query;

    try {
        const start = parseInt(page);
        const size = parseInt(pageSize);
        const offset = (start - 1) * size;

        // 使用 ZREVRANGE 分页查询（倒序）
        const logStrings = await redis.zrevrange(
            CacheKeys.LOGS_LIST_KEY,
            offset,
            offset + size - 1
        );

        // 解析日志
        let logs = [];
        for (const logStr of logStrings) {
            try {
                const log = JSON.parse(logStr);
                // 验证必需字段
                if (!log.id || !log.action || !log.created_at) {
                    continue;
                }
                // 解析浏览器信息
                log.browser = logger.parseBrowser(log.user_agent);
                logs.push(log);
            } catch (parseError) {
                console.warn('解析日志失败:', parseError);
            }
        }

        // 应用筛选条件
        if (action) {
            logs = logs.filter(log => log.action.toLowerCase().includes(action.toLowerCase()));
        }

        if (method) {
            logs = logs.filter(log => log.method === method);
        }

        if (status) {
            logs = logs.filter(log => log.status === parseInt(status));
        }

        if (startDate) {
            const startTime = new Date(startDate).getTime();
            logs = logs.filter(log => new Date(log.created_at).getTime() >= startTime);
        }

        if (endDate) {
            const endTime = new Date(endDate).getTime();
            logs = logs.filter(log => new Date(log.created_at).getTime() <= endTime);
        }

        // 获取总数
        let total = await redis.zcard(CacheKeys.LOGS_LIST_KEY);

        // 如果有日期筛选，需要重新计算总数
        if (startDate || endDate) {
            const minScore = startDate ? new Date(startDate).getTime() : '-inf';
            const maxScore = endDate ? new Date(endDate).getTime() : '+inf';
            total = await redis.zcount(CacheKeys.LOGS_LIST_KEY, minScore, maxScore);
        }

        // 格式化时间
        const processedLogs = logs.map(log => ({
            ...log,
            created_at: new Date(log.created_at).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
        }));

        res.json({
            success: true,
            message: '获取成功',
            data: {
                list: processedLogs,
                pagination: {
                    page: start,
                    pageSize: size,
                    total,
                    totalPages: Math.ceil(total / size)
                }
            }
        });
    } catch (error) {
        console.error('获取日志失败:', error);
        res.status(500).json({
            success: false,
            error: '获取日志失败'
        });
    }
}));

/**
 * DELETE /api/logs - 清空日志
 * 查询参数:
 *   - days: 保留最近多少天的日志（可选，默认为0表示清空所有）
 */
router.delete('/', asyncHandler(async (req, res) => {
    const { days = 0 } = req.query;
    const daysNum = parseInt(days);

    if (daysNum < 0) {
        return res.status(400).json({
            success: false,
            error: 'days参数不能为负数'
        });
    }

    try {
        const now = Date.now();

        if (daysNum === 0) {
            // 清空所有日志
            const deletedCount = await redis.del(CacheKeys.LOGS_LIST_KEY);
            await logger.logFromRequest(req, `清空所有日志，删除 ${deletedCount} 条记录`, 200);

            res.json({
                success: true,
                message: '清理成功',
                data: {
                    deletedCount
                }
            });
        } else {
            // 删除指定天数之前的日志
            const expireTime = now - daysNum * 24 * 60 * 60 * 1000;

            // 使用 ZREMRANGEBYSCORE 删除
            const deletedCount = await redis.zremrangebyscore(
                CacheKeys.LOGS_LIST_KEY,
                '-inf',
                expireTime
            );

            await logger.logFromRequest(req, `清理 ${daysNum} 天前的日志，删除 ${deletedCount} 条记录`, 200);

            res.json({
                success: true,
                message: '清理成功',
                data: {
                    deletedCount
                }
            });
        }
    } catch (error) {
        console.error('清理日志失败:', error);
        res.status(500).json({
            success: false,
            error: '清理日志失败'
        });
    }
}));

module.exports = router;
