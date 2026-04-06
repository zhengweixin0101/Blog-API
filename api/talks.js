const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { clearTalksCache } = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');
const { CacheKeys } = require('../utils/constants');
const { Cache } = require('../utils/config');
const logger = require('../logger');

const redis = db.redis;

/**
 * GET /api/talks - 获取说说列表
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

    const cached = await redis.get(cacheKey);
    if (cached) {
        const parsed = JSON.parse(cached);
        return res.json({
            success: true,
            message: '获取成功',
            ...parsed
        });
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

    await redis.set(cacheKey, JSON.stringify(responseData), 'EX', Cache.TTL.TALKS_LIST);

    res.json({
        success: true,
        message: '获取成功',
        ...responseData
    });
}));

/**
 * POST /api/talks - 添加说说
 * Body: { content, location?, links?, imgs?, tags? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { content, location, links = [], imgs = [], tags = [] } = req.body;

    const linksArray = Array.isArray(links) ? links : [links];
    const imgsArray = Array.isArray(imgs) ? imgs : [imgs];

    const query = `
        INSERT INTO talks (content, location, links, imgs, tags, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *;
    `;

    const result = await db.query(query, [
        content,
        location || null,
        JSON.stringify(linksArray),
        JSON.stringify(imgsArray),
        tags,
    ]);

    await clearTalksCache();

    await logger.logFromRequest(req, `添加说说 #${result.rows[0].id}`, 201);

    res.json({
        success: true,
        message: '说说添加成功',
        talk: result.rows[0]
    });
}));

/**
 * PUT /api/talks - 编辑说说
 * Body: { id, content?, location?, tags?, links?, imgs? }
 */
router.put('/', asyncHandler(async (req, res) => {
    const { id, content, location, tags, links, imgs } = req.body;

    if (!id) {
        const err = new Error('缺少说说 id');
        err.status = 400;
        throw err;
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (content !== undefined) {
        fields.push(`content = $${idx++}`);
        values.push(content);
    }
    if (location !== undefined) {
        fields.push(`location = $${idx++}`);
        values.push(location);
    }
    if (tags !== undefined) {
        fields.push(`tags = $${idx++}`);
        values.push(tags);
    }
    if (links !== undefined) {
        fields.push(`links = $${idx++}`);
        values.push(JSON.stringify(Array.isArray(links) ? links : [links]));
    }
    if (imgs !== undefined) {
        fields.push(`imgs = $${idx++}`);
        values.push(JSON.stringify(Array.isArray(imgs) ? imgs : [imgs]));
    }

    if (fields.length === 0) {
        const err = new Error('没有需要更新的字段');
        err.status = 400;
        throw err;
    }

    values.push(id);

    const query = `
        UPDATE talks
        SET ${fields.join(', ')}
        WHERE id = $${idx}
        RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
        const err = new Error('说说不存在');
        err.status = 404;
        throw err;
    }

    await clearTalksCache();

    await logger.logFromRequest(req, `编辑说说 #${id}`, 200);

    res.json({
        success: true,
        message: '说说编辑成功',
        talk: result.rows[0]
    });
}));

/**
 * DELETE /api/talks - 删除说说
 */
router.delete('/', asyncHandler(async (req, res) => {
    const id = req.body?.id;

    if (!id) {
        const err = new Error('缺少说说 id');
        err.status = 400;
        throw err;
    }

    const result = await db.query(
        'DELETE FROM talks WHERE id = $1 RETURNING id',
        [id]
    );

    if (result.rowCount === 0) {
        const err = new Error('说说未找到');
        err.status = 404;
        throw err;
    }

    await clearTalksCache();

    await logger.logFromRequest(req, `删除说说 #${id}`, 200);

    res.json({
        success: true,
        message: `说说 '${id}' 删除成功`
    });
}));

module.exports = router;
