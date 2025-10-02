const express = require('express');
const router = express.Router();
const db = require('../../db');

// 删除说说接口
// 前端发送 JSON: { id: '说说id' }
router.delete('/', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    try {
        const result = await db.query(
            'DELETE FROM talks WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Talk not found' });
        }

        res.json({ message: `Talk '${id}' deleted successfully` });
    } catch (err) {
        console.error(`Error deleting talk ${id}:`, err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
