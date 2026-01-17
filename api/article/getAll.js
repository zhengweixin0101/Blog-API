const express = require('express');
const router = express.Router();
const db = require('../../db');
const { asyncHandler } = require('../../middleware/errorHandler');

/**
 * GET /api/article/all - 获取所有文章（包含 content）
 * Query: ?page=<page>&pageSize=<pageSize>&sort=asc|desc (默认 desc)
 */
router.get('/', asyncHandler(async (req, res) => {
	let { page, pageSize, sort = 'desc' } = req.query;

	// 验证排序参数
	const validSortValues = ['asc', 'desc'];
	if (!validSortValues.includes(sort.toLowerCase())) {
		const err = new Error('排序参数只能是 asc 或 desc');
		err.status = 400;
		throw err;
	}

	const sortOrder = sort.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

	let result;
	if (!page && !pageSize) {
		const { rows } = await db.query(
			`SELECT slug, title, description, tags, content,
				TO_CHAR(date, 'YYYY-MM-DD') AS date,
				published
			 FROM articles
			 ORDER BY date ${sortOrder}`
		);
		result = { rows };
	} else if ((page && !pageSize) || (!page && pageSize)) {
		const err = new Error('分页参数不完整，必须同时提供 page 和 pageSize');
		err.status = 400;
		throw err;
	} else {
		page = Number(page);
		pageSize = Number(pageSize);

		if (isNaN(page) || isNaN(pageSize) || page <= 0 || pageSize <= 0) {
			const err = new Error('分页参数必须为正整数');
			err.status = 400;
			throw err;
		}

		const offset = (page - 1) * pageSize;
		const { rows } = await db.query(
			`SELECT slug, title, description, tags, content,
				TO_CHAR(date, 'YYYY-MM-DD') AS date,
				published
			 FROM articles
			 ORDER BY date ${sortOrder}
			 LIMIT $1 OFFSET $2`,
			[pageSize, offset]
		);
		result = { rows };
	}

	// 获取总数
	const totalResult = await db.query('SELECT COUNT(*) FROM articles');
	const total = parseInt(totalResult.rows[0].count, 10);

	const responseData = {
		data: result.rows,
		allTags: [],
		page: page ? Number(page) : null,
		pageSize: pageSize ? Number(pageSize) : null,
		total,
		totalPages: pageSize ? Math.ceil(total / pageSize) : 1,
	};

	res.json({
		success: true,
		message: '获取成功',
		...responseData
	});
}));

module.exports = router;