const express = require('express');
const db = require('../../db.js');
const router = express.Router();

// 获取说说接口
// 直接请求
// 支持分页和筛选 ?page=2&pageSize=5&tag=其他
router.get('/', async (req, res) => {
    try {
        let { page, pageSize, tag, sort = 'desc' } = req.query;
        const sortOrder = sort.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

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

        if (!page && !pageSize) {
            result = await db.query(baseQuery, params);
        }
        else if ((page && !pageSize) || (!page && pageSize)) {
            return res.status(400).json({
                message: '分页参数不完整，必须同时提供 page 和 pageSize'
            });
        }
        else {
            page = Number(page);
            pageSize = Number(pageSize);

            if (isNaN(page) || isNaN(pageSize) || page <= 0 || pageSize <= 0) {
                return res.status(400).json({
                    message: '分页参数必须为正整数'
                });
            }

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

        res.json({
            data: result.rows,
            page: page ? Number(page) : null,
            pageSize: pageSize ? Number(pageSize) : null,
            total,
            totalPages: pageSize ? Math.ceil(total / pageSize) : 1
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '获取说说失败' });
    }
});

module.exports = router;
