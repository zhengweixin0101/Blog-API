const express = require('express');
const router = express.Router();
const db = require('../../db');
const { marked } = require('marked');
const { asyncHandler } = require('../../middleware/errorHandler');
const { CacheKeys } = require('../../utils/constants');
const { Cache } = require('../../utils/config');

const redis = db.redis;

/**
 * GET /api/article/get - 获取文章内容
 * Query: ?slug={slug}&type=markdown|html (默认 markdown)
 */
router.get('/', asyncHandler(async (req, res) => {
    const { slug, type = 'markdown' } = req.query;
    
    if (!slug) {
        const err = new Error('缺少 slug');
        err.status = 400;
        throw err;
    }

    const cacheKey = CacheKeys.postDetailKey(slug, type === 'html');

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

    if (redis) {
        await redis.set(
            cacheKey,
            JSON.stringify(responseData),
            'EX',
            Cache.TTL.POST_DETAIL
        );
    }

    res.json({
        success: true,
        message: '获取成功',
        ...responseData
    });
}));

module.exports = router;