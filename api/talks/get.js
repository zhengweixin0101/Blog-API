const express = require('express');
const router = express.Router();
const db = require('../../db.js');
const { asyncHandler } = require('../../middleware/errorHandler');
const { CacheKeys } = require('../../utils/constants');
const { Cache } = require('../../utils/config');

const redis = db.redis;

/**
 * GET /api/talks/get - 获取说说列表
 * Query: ?page=<page>&pageSize=<pageSize>&tag=<tag>&sort=asc|desc (默认 desc)
 */
router.get('/', asyncHandler(async (req, res) => {
    let { page, pageSize, tag, sort = 'desc' } = req.query;

    // 验证排序参数
    const validSortValues = ['asc', 'desc'];
    if (!validSortValues.includes(sort.toLowerCase())) {
        const err = new Error('排序参数只能是 asc 或 desc');
        err.status = 400;
        throw err;
    }

    // 转换为数字或 null
    page = page ? Number(page) : null;
    pageSize = pageSize ? Number(pageSize) : null;

    // 验证分页参数完整性
    if ((page && !pageSize) || (!page && pageSize)) {
        const err = new Error('分页参数不完整，必须同时提供 page 和 pageSize');
        err.status = 400;
        throw err;
    }

    // 验证参数有效性
    if ((page && (isNaN(page) || page <= 0)) || (pageSize && (isNaN(pageSize) || pageSize <= 0))) {
        const err = new Error('分页参数必须为正整数');
        err.status = 400;
        throw err;
    }

    const sortOrder = sort.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const cacheKey = CacheKeys.talksListKey(page, pageSize, tag, sort);

    if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            return res.json({
                success: true,
                message: '获取成功',
                ...parsed
            });
        }
    }

    const params = [];
    let whereClause = '';
    if (tag) {
        params.push(tag);
        whereClause = `WHERE $1 = ANY(tags)`;
    }

    let baseQuery = `
        SELECT * FROM talks
        ${whereClause}
        ORDER BY created_at ${sortOrder}
    `;

    let result;
    // 不提供分页参数时返回全部数据
    if (!page && !pageSize) {
        result = await db.query(baseQuery, params);
    } else {
        const offset = (page - 1) * pageSize;
        const limitIndex = params.length + 1;
        const offsetIndex = params.length + 2;

        baseQuery += ` LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
        params.push(pageSize, offset);

        result = await db.query(baseQuery, params);
    }

    let totalQuery = 'SELECT COUNT(*) FROM talks';
    const totalParams = [];
    if (tag) {
        totalQuery += ' WHERE $1 = ANY(tags)';
        totalParams.push(tag);
    }
    const totalResult = await db.query(totalQuery, totalParams);
    const total = parseInt(totalResult.rows[0].count, 10);

    const tagResult = await db.query(`
        SELECT DISTINCT unnest(tags) AS tag
        FROM talks
        WHERE tags IS NOT NULL
    `);
    const allTags = tagResult.rows.map(r => r.tag).filter(Boolean);

    const responseData = {
        data: result.rows,
        allTags,
        page: page ? Number(page) : null,
        pageSize: pageSize ? Number(pageSize) : null,
        total,
        totalPages: pageSize ? Math.ceil(total / pageSize) : 1,
    };

    if (redis) {
        await redis.set(cacheKey, JSON.stringify(responseData), 'EX', Cache.TTL.TALKS_LIST);
    }

    res.json({
        success: true,
        message: '获取成功',
        ...responseData
    });
}));

module.exports = router;