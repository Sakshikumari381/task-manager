const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    if (search) {
      const users = await db.prepare(`SELECT id, name, email, role FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 20`).all(`%${search}%`, `%${search}%`);
      return res.json(users);
    }
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const users = await db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/role', authenticate, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Role updated' });
});

module.exports = router;
