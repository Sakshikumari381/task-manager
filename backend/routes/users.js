const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/users - admin only, or for member search when adding to project
router.get('/', authenticate, (req, res) => {
  const { search } = req.query;
  let users;
  if (search) {
    users = db.prepare(`
      SELECT id, name, email, role FROM users
      WHERE name LIKE ? OR email LIKE ?
      LIMIT 20
    `).all(`%${search}%`, `%${search}%`);
  } else {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
  }
  res.json(users);
});

// PUT /api/users/:id/role - admin only
router.put('/:id/role', authenticate, requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Role updated' });
});

module.exports = router;
