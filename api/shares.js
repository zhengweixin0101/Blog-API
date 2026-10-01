const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db.js');
const { clearSharesCache } = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');
const { CacheKeys } = require('../utils/constants');
const { Cache } = require('../utils/config');
const logger = require('../logger');

const redis = db.redis;

// 分享 id 格式：1-64 位字母数字，允许 - 和 _
// 不传 id 时由服务端生成 4 字节随机数的十六进制
const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * 生成分享 id
 * @returns {string} 8 位随机十六进制字符串
 */
function generateShareId() {
    return crypto.randomBytes(4).toString('hex');
}

/**
 * GET /api/shares - 获取分享列表
 * 或 GET /api/shares?id=xxx - 获取单个分享
 *   ?type=json（默认） 返回分享对象；
 *   ?type=redirect      跳转到一个网盘链接（用于在博客文章里直链），
 *                        支持 ?driveName=xxx 选定具体网盘，不传默认跳转 drives[0]
 */
router.get('/', asyncHandler(async (req, res) => {
    const id = req.query.id;

    // 单条获取 / 跳转（id 不能为空）
    if (id !== undefined) {
        if (typeof id !== 'string' || !SHARE_ID_REGEX.test(id)) {
            const err = new Error('分享 id 格式不正确');
            err.status = 400;
            throw err;
        }

        const type = req.query.type || 'json';
        const cacheKey = CacheKeys.shareDetailKey(id);

        const cached = await redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.__notFound) {
                const err = new Error('分享未找到');
                err.status = 404;
                throw err;
            }
            return respondByShare(parsed, type, req, res);
        }

        const { rows } = await db.query(
            'SELECT * FROM shares WHERE id = $1',
            [id]
        );

        if (!rows[0]) {
            await redis.set(
                cacheKey,
                JSON.stringify({ __notFound: true }),
                'EX',
                Cache.TTL.NOT_FOUND
            );
            const err = new Error('分享未找到');
            err.status = 404;
            throw err;
        }

        await redis.set(cacheKey, JSON.stringify(rows[0]), 'EX', Cache.TTL.SHARE_DETAIL);

        return respondByShare(rows[0], type, req, res);
    }

    // 列表
    const cacheKey = CacheKeys.SHARES_LIST;

    const cached = await redis.get(cacheKey);
    if (cached) {
        const parsed = JSON.parse(cached);
        return res.json({
            success: true,
            message: '获取成功',
            ...parsed
        });
    }

    const result = await db.query(
        'SELECT * FROM shares ORDER BY created_at DESC'
    );

    const responseData = { data: result.rows };

    await redis.set(cacheKey, JSON.stringify(responseData), 'EX', Cache.TTL.SHARES_LIST);

    res.json({
        success: true,
        message: '获取成功',
        ...responseData
    });
}));

/**
 * 根据 type 响应：json 返回分享对象，redirect 跳转到一个网盘链接
 */
function respondByShare(share, type, req, res) {
    if (type === 'redirect') {
        const { driveName } = req.query;
        const drives = Array.isArray(share.drives) ? share.drives : [];
        const target = driveName
            ? drives.find(d => d.driveName === driveName)
            : drives[0];

        if (!target || !target.url) {
            const err = new Error(driveName ? '指定网盘不存在' : '该分享暂无网盘链接');
            err.status = 404;
            throw err;
        }

        return res.redirect(302, target.url);
    }

    res.json({
        success: true,
        message: '获取成功',
        data: share
    });
}

/**
 * POST /api/shares - 添加/修改分享（不传 id 为新增并自动生成 id）
 * Body: { name, description?, drives? }
 *        { id, name?, description?, drives? } - id 已存在则修改，不存在则以该 id 新增
 */
router.post('/', asyncHandler(async (req, res) => {
    const { id, name, description, drives } = req.body;

    // 传了 id：已存在则修改，不存在则以该 id 新增
    if (id !== undefined) {
        if (!SHARE_ID_REGEX.test(id)) {
            const err = new Error('分享 id 格式不正确');
            err.status = 400;
            throw err;
        }

        const fields = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(name);
        }
        if (description !== undefined) {
            fields.push(`description = $${idx++}`);
            values.push(description || '');
        }
        if (drives !== undefined) {
            fields.push(`drives = $${idx++}`);
            values.push(JSON.stringify(drives));
        }

        if (fields.length === 0) {
            const err = new Error('没有需要更新的字段');
            err.status = 400;
            throw err;
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query(
            `UPDATE shares SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (result.rowCount > 0) {
            await clearSharesCache();

            logger.logFromRequest(req, `更新分享 "${id}"`, 200);

            return res.json({
                success: true,
                message: '分享更新成功',
                share: result.rows[0]
            });
        }

        // 该 id 尚不存在，按新增处理
        if (name === undefined) {
            const err = new Error('新增分享需要提供 name');
            err.status = 400;
            throw err;
        }
    }

    const newId = id !== undefined ? id : generateShareId();

    const query = `
        INSERT INTO shares (id, name, description, drives, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *;
    `;

    // 主键冲突时提示
    let result;
    try {
        result = await db.query(query, [
            newId,
            name,
            description || '',
            JSON.stringify(drives || [])
        ]);
    } catch (err) {
        if (err.code === '23505') {
            const conflict = new Error('分享 id 已存在，请换一个 id 重试');
            conflict.status = 409;
            throw conflict;
        }
        throw err;
    }

    await clearSharesCache();

    logger.logFromRequest(req, `添加分享 "${newId}"`, 201);

    res.json({
        success: true,
        message: '分享添加成功',
        share: result.rows[0]
    });
}));

/**
 * DELETE /api/shares - 删除分享
 */
router.delete('/', asyncHandler(async (req, res) => {
    const id = req.body?.id;

    if (!id) {
        const err = new Error('缺少分享 id');
        err.status = 400;
        throw err;
    }

    const result = await db.query(
        'DELETE FROM shares WHERE id = $1 RETURNING id',
        [id]
    );

    if (result.rowCount === 0) {
        const err = new Error('分享未找到');
        err.status = 404;
        throw err;
    }

    await clearSharesCache();

    logger.logFromRequest(req, `删除分享 "${id}"`, 200);

    res.json({
        success: true,
        message: `分享 '${id}' 删除成功`
    });
}));

module.exports = router;
