const express = require('express');
const { marked } = require('marked');
const router = express.Router();
const db = require('../db.js');
const { clearPostListCache, clearPostCache } = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');
const { CacheKeys } = require('../utils/constants');
const { Cache } = require('../utils/config');

const redis = db.redis;

// 文章字段映射配置
const FIELD_MAP = {
    slug: 'slug',
    title: 'title',
    description: 'description',
    tags: 'tags',
    content: 'content',
    published: 'published',
    date: "TO_CHAR(date, 'YYYY-MM-DD') AS date",
};

/**
 * GET /api/articles/:slug - 获取单篇文章详情
 * Query: ?type=html|markdown
 *   - type: 返回格式，'html' 或 'markdown'（默认 markdown）
 */
router.get('/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { type = 'markdown' } = req.query;

    const cacheKey = CacheKeys.postDetailKey(slug, type === 'html');

    const cached = await redis.get(cacheKey);
    if (cached) {
        const parsed = JSON.parse(cached);
        return res.json({
            success: true,
            message: '获取成功',
            ...parsed
        });
    }

    const { rows } = await db.query(
        `SELECT slug, title, description, tags, content,
                TO_CHAR(date, 'YYYY-MM-DD') AS date,
                published
         FROM articles
         WHERE slug = $1`,
        [slug]
    );

    if (!rows[0]) {
        const err = new Error('文章未找到');
        err.status = 404;
        throw err;
    }

    const article = rows[0];

    const content =
        type === 'html'
            ? marked.parse(article.content || '')
            : article.content || '';

    const responseData = {
        frontmatter: {
            slug: article.slug,
            title: article.title,
            date: article.date,
            description: article.description || '',
            tags: article.tags || [],
            published: article.published,
        },
        content,
    };

    await redis.set(
        cacheKey,
        JSON.stringify(responseData),
        'EX',
        Cache.TTL.POST_DETAIL
    );

    return res.json({
        success: true,
        message: '获取成功',
        ...responseData
    });
}));

/**
 * GET /api/articles - 获取文章列表
 * Query: ?posts=all|published&fields=slug,title,date&page=1&pageSize=10&sort=asc|desc
 *   - posts: 'all' 返回所有文章（包含未发布），'published' 或不传返回已发布的文章
 *   - fields: 指定返回的字段，用逗号分隔（可选），不传则返回所有字段
 *   - page: 页码（可选）
 *   - pageSize: 每页数量（可选）
 *   - sort: 排序方向，'asc' 或 'desc'（默认 desc）
 */
router.get('/', asyncHandler(async (req, res) => {
    const { posts, fields: fieldsQuery } = req.query;
    const fields = fieldsQuery ? fieldsQuery.split(',').map(f => f.trim()) : null;
    const { page, pageSize, sort = 'desc' } = req.query;

    // 验证排序参数
    const validSortValues = ['asc', 'desc'];
    if (!validSortValues.includes(sort.toLowerCase())) {
        const err = new Error('排序参数只能是 asc 或 desc');
        err.status = 400;
        throw err;
    }

    const all = posts === 'all';
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

    // 默认不包含 content，只有显式指定 fields 时才返回
    const defaultColumns = Object.entries(FIELD_MAP)
        .filter(([key]) => key !== 'content')
        .map(([, value]) => value);

    const columns = fields
        ? fields
            .filter(f => {
                return allowedFields.includes(f) || f === 'content';
            })
            .map(f => {
                if (f === 'content') return 'content';
                return FIELD_MAP[f];
            })
        : defaultColumns;

    let query = `SELECT ${columns.join(', ')} FROM articles`;
    const params = [];

    if (!all) {
        query += ' WHERE published = true';
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

/**
 * POST /api/articles - 创建新文章
 * Body: { slug, title?, content?, tags?, description?, date?, published? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { slug, title, content, tags, description, date, published } = req.body;

    // 检查是否已存在
    const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
        const err = new Error('此 slug 的文章已存在');
        err.status = 409;
        throw err;
    }

    const result = await db.query(
        `INSERT INTO articles
            (slug, title, content, tags, description, date, published, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
            slug,
            title || '',
            content || '',
            tags || [],
            description || null,
            date || null,
            published !== undefined ? published : false
        ]
    );

    const newArticle = result.rows[0];
    await clearPostListCache();

    res.json({
        success: true,
        message: '文章添加成功',
        article: newArticle
    });
}));

/**
 * PUT /api/articles - 编辑文章内容
 * Body: { slug, title?, content?, tags?, description?, date?, published? }
 */
router.put('/', asyncHandler(async (req, res) => {
    const { slug, title, content, tags, description, date, published } = req.body;

    if (!slug) {
        const err = new Error('缺少文章 slug');
        err.status = 400;
        throw err;
    }

    // 检查文章是否存在
    const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [slug]);
    if (existing.rows.length === 0) {
        const err = new Error('文章未找到');
        err.status = 404;
        throw err;
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (content !== undefined) { fields.push(`content = $${idx++}`); values.push(content); }
    if (tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(tags); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (date !== undefined) { fields.push(`date = $${idx++}`); values.push(date); }
    if (published !== undefined) { fields.push(`published = $${idx++}`); values.push(published); }

    if (fields.length === 0) {
        const err = new Error('没有需要更新的字段');
        err.status = 400;
        throw err;
    }

    fields.push(`updated_at = NOW()`);
    const query = `UPDATE articles SET ${fields.join(', ')} WHERE slug = $${idx} RETURNING *`;
    values.push(slug);

    const result = await db.query(query, values);

    await clearPostListCache();
    await clearPostCache(slug);

    res.json({
        success: true,
        message: '文章更新成功',
        article: result.rows[0]
    });
}));

/**
 * PATCH /api/articles - 修改文章 slug
 * Body: { oldSlug, newSlug }
 */
router.patch('/', asyncHandler(async (req, res) => {
    const { oldSlug, newSlug } = req.body;

    if (!oldSlug) {
        const err = new Error('缺少 oldSlug');
        err.status = 400;
        throw err;
    }

    if (!newSlug) {
        const err = new Error('缺少 newSlug');
        err.status = 400;
        throw err;
    }

    // 检查旧 slug 是否存在
    const existing = await db.query('SELECT * FROM articles WHERE slug = $1', [oldSlug]);
    if (existing.rows.length === 0) {
        const err = new Error('文章未找到');
        err.status = 404;
        throw err;
    }

    // 检查新 slug 是否已经存在
    const conflict = await db.query('SELECT * FROM articles WHERE slug = $1', [newSlug]);
    if (conflict.rows.length > 0) {
        const err = new Error('已存在使用此 slug 的文章');
        err.status = 409;
        throw err;
    }

    // 更新 slug
    const result = await db.query(
        'UPDATE articles SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING *',
        [newSlug, oldSlug]
    );

    const updatedArticle = result.rows[0];

    await clearPostListCache();
    await clearPostCache(oldSlug);
    await clearPostCache(newSlug);

    res.json({
        success: true,
        message: 'slug 更新成功',
        article: updatedArticle
    });
}));

/**
 * DELETE /api/articles - 删除文章
 * Body: { slug }
 */
router.delete('/', asyncHandler(async (req, res) => {
    const slug = req.body?.slug;

    if (!slug) {
        const err = new Error('缺少文章 slug');
        err.status = 400;
        throw err;
    }

    const result = await db.query(
        'DELETE FROM articles WHERE slug = $1 RETURNING slug',
        [slug]
    );

    if (result.rowCount === 0) {
        const err = new Error('文章未找到');
        err.status = 404;
        throw err;
    }

    await clearPostListCache();
    await clearPostCache(slug);

    res.json({
        success: true,
        message: `文章 '${slug}' 删除成功`
    });
}));

module.exports = router;
