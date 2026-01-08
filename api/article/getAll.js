const express = require('express');
const router = express.Router();
const db = require('../../db');

// 一次性获取所有文章（包含 content）
// 管理/导出用途：返回所有文章的完整数据
// 支持分页 ?page=1&pageSize=10
router.get('/', async (req, res) => {
	try {
		let { page, pageSize } = req.query;

		let result;
		if (!page && !pageSize) {
			const { rows } = await db.query(
				`SELECT slug, title, description, tags, content,
					TO_CHAR(date, 'YYYY-MM-DD') AS date,
					published
				 FROM articles
				 ORDER BY date DESC`
			);
			result = { rows };
		} else if ((page && !pageSize) || (!page && pageSize)) {
			return res.status(400).json({
				error: '分页参数不完整，必须同时提供 page 和 pageSize'
			});
		} else {
			page = Number(page);
			pageSize = Number(pageSize);

			if (isNaN(page) || isNaN(pageSize) || page <= 0 || pageSize <= 0) {
				return res.status(400).json({
					error: '分页参数必须为正整数'
				});
			}

			const offset = (page - 1) * pageSize;
			const { rows } = await db.query(
				`SELECT slug, title, description, tags, content,
					TO_CHAR(date, 'YYYY-MM-DD') AS date,
					published
				 FROM articles
				 ORDER BY date DESC
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

		res.json(responseData);
	} catch (err) {
		console.error('获取所有文章失败：', err);
		res.status(500).json({ error: '数据库错误' });
	}
});

module.exports = router;