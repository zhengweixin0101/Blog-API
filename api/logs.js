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
        const targetStart = (start - 1) * size;
        const targetEnd = targetStart + size - 1;

        const minScore = startDate ? new Date(startDate).getTime() : '-inf';
        const maxScore = endDate ? new Date(endDate).getTime() : '+inf';

        const statusNum = status !== undefined ? parseInt(status) : null;
        const actionLower = action ? action.toLowerCase() : null;

        const matchFilter = (log) => {
            if (!log.id || !log.action || !log.created_at) return false;
            if (actionLower && !log.action.toLowerCase().includes(actionLower)) return false;
            if (method && log.method !== method) return false;
            if (statusNum !== null && log.status !== statusNum) return false;
            return true;
        };

        const BATCH = 200;
        const pageLogs = [];
        let matched = 0;
        let scanned = 0;

        while (true) {
            const batch = await redis.zrevrangebyscore(
                CacheKeys.LOGS_LIST_KEY,
                maxScore,
                minScore,
                'LIMIT',
                scanned,
                BATCH - 1
            );
            if (batch.length === 0) break;
            scanned += batch.length;

            for (const logStr of batch) {
                let log;
                try {
                    log = JSON.parse(logStr);
                } catch (parseError) {
                    console.warn('解析日志失败:', parseError);
                    continue;
                }
                if (!matchFilter(log)) continue;

                if (matched >= targetStart && matched <= targetEnd) {
                    log.browser = logger.parseBrowser(log.user_agent);
                    pageLogs.push(log);
                }
                matched++;
            }

            if (batch.length < BATCH) break;
        }

        const total = matched;

        // 格式化时间
        const processedLogs = pageLogs.map(log => ({
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
            logger.logFromRequest(req, `清空所有日志，删除 ${deletedCount} 条记录`, 200);

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

            logger.logFromRequest(req, `清理 ${daysNum} 天前的日志，删除 ${deletedCount} 条记录`, 200);

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
