const express = require('express');
const router = express.Router();
const db = require('../../db');

const redis = db.redis;

// 删除说说接口
// 前端发送 JSON: { id: '说说id' }
router.delete('/', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID 是必须的' });

    try {
        const result = await db.query(
            'DELETE FROM talks WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '说说未找到' });
        }

        if (redis) {
            const keys = await redis.keys('talks:*');
            if (keys.length > 0) {
                await redis.del(keys);
            }
        }

        res.json({ message: `说说 '${id}' 删除成功` });
    } catch (err) {
        console.error(`删除说说 ${id} 失败:`, err);
        res.status(500).json({ error: '数据库错误' });
    }
});

module.exports = router;