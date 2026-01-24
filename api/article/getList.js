const express = require('express');
const router = express.Router();
const db = require('../../db');
const { asyncHandler } = require('../../middleware/errorHandler');
const { CacheKeys } = require('../../utils/constants');
const { Cache } = require('../../utils/config');

const redis = db.redis;

// 文章字段映射配置
const FIELD_MAP = {
    slug: 'slug',
    title: 'title',
    description: 'description',
    tags: 'tags',
    published: 'published',
    date: "TO_CHAR(date, 'YYYY-MM-DD') AS date",
};

/**
 * GET /api/article/list - 获取文章列表
 * Query: ?posts=all&fields=slug,title,date&page=<page>&pageSize=<pageSize>&sort=asc|desc (默认 desc)
 */
router.get('/', asyncHandler(async (req, res) => {
    const all = req.query.posts === 'all';
    const fieldsQuery = req.query.fields;
    const fields = fieldsQuery ? fieldsQuery.split(',').map(f => f.trim()) : null;
    const { page, pageSize, sort = 'desc' } = req.query;

    // 验证排序参数
    const validSortValues = ['asc', 'desc'];
    if (!validSortValues.includes(sort.toLowerCase())) {
        const err = new Error('排序参数只能是 asc 或 desc');
        err.status = 400;
        throw err;
    }

    const cacheKey = CacheKeys.postListKey(all, fields, page, pageSize);

    const cached = await redis.get(cacheKey);
    if (cached) {
        const parsed = JSON.parse(cached);
        return res.json({
            success: true,
            message: '获取成功',
            data: parsed
        });
    }

    const allowedFields = Object.keys(FIELD_MAP);

    const columns = fields
        ? fields
            .filter(f => allowedFields.includes(f))
            .map(f => FIELD_MAP[f])
        : Object.values(FIELD_MAP);

    let query = `SELECT ${columns.join(', ')} FROM articles`;
    const params = [];
    let whereClause = '';

    if (!all) {
        whereClause = 'WHERE published = true';
        query += ` ${whereClause}`;
    }

    const sortOrder = sort.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY date ${sortOrder}`;

    // 分页处理
    if (page && pageSize) {
        const pageNum = Number(page);
        const pageSizeNum = Number(pageSize);

        if (isNaN(pageNum) || isNaN(pageSizeNum) || pageNum <= 0 || pageSizeNum <= 0) {
            const err = new Error('分页参数必须为正整数');
            err.status = 400;
            throw err;
        }

        const offset = (pageNum - 1) * pageSizeNum;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(pageSizeNum, offset);
    }

    const { rows } = await db.query(query, params);

    await redis.set(cacheKey, JSON.stringify(rows), 'EX', Cache.TTL.POST_LIST);

    res.json({
        success: true,
        message: '获取成功',
        data: rows
    });
}));

module.exports = router;