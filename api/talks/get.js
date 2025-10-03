const express = require('express');
const db = require('../../db.js');
const router = express.Router();

// 获取说说接口
// 直接请求
// 支持分页和筛选 ?page=2&pageSize=5&tag=其他
router.get('/', async (req, res) => {
    try {
        let { page = 1, pageSize = 10, tag, sort = 'desc' } = req.query;
        page = Number(page);
        pageSize = Number(pageSize);
        const offset = (page - 1) * pageSize;

        const params = [];
        let whereClause = '';
        if (tag) {
            params.push(tag);
            whereClause = `WHERE $1 = ANY(tags)`;
        }

        const baseQuery = `
            SELECT * FROM talks
            ${whereClause}
            ORDER BY created_at ${sort.toLowerCase() === 'asc' ? 'ASC' : 'DESC'}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(pageSize, offset);

        const result = await db.query(baseQuery, params);

        let totalQuery = 'SELECT COUNT(*) FROM talks';
        if (tag) totalQuery += ` WHERE $1 = ANY(tags)`;
        const totalResult = await db.query(totalQuery, tag ? [tag] : []);
        const total = parseInt(totalResult.rows[0].count);

        res.json({
            data: result.rows,
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '获取说说失败' });
    }
});

module.exports = router;