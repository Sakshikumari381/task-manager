const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

async function isProjectAdmin(projectId, userId) {
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (user && user.role === 'admin') return true;
  const m = await db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
  return m?.role === 'admin';
}

router.get('/', authenticate, async (req, res) => {
  try {
    let projects;
    if (req.user.role === 'admin') {
      projects = await db.prepare(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p JOIN users u ON p.owner_id = u.id ORDER BY p.created_at DESC
      `).all();
    } else {
      projects = await db.prepare(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p JOIN users u ON p.owner_id = u.id
        JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = ? ORDER BY p.created_at DESC
      `).all(req.user.id);
    }
    res.json(projects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, [
  body('name').trim().notEmpty(),
  body('description').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, description } = req.body;
  try {
    const result = await db.prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
    await db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user.id, 'admin');
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const project = await db.prepare(`SELECT p.*, u.name as owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?`).get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (req.user.role !== 'admin') {
      const member = await db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!member) return res.status(403).json({ error: 'Access denied' });
    }
    const members = await db.prepare(`
      SELECT u.id, u.name, u.email, u.role as global_role, pm.role as project_role
      FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?
    `).all(req.params.id);
    res.json({ ...project, members });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  if (!await isProjectAdmin(req.params.id, req.user.id)) return res.status(403).json({ error: 'Admin required' });
  const { name, description } = req.body;
  await db.prepare('UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?').run(name, description, req.params.id);
  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

router.delete('/:id', authenticate, async (req, res) => {
  if (!await isProjectAdmin(req.params.id, req.user.id)) return res.status(403).json({ error: 'Admin required' });
  await db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ message: 'Project deleted' });
});

router.post('/:id/members', authenticate, [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'member']),
], async (req, res) => {
  if (!await isProjectAdmin(req.params.id, req.user.id)) return res.status(403).json({ error: 'Admin required' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, role = 'member' } = req.body;
  try {
    const user = await db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = await db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, user.id);
    if (existing) return res.status(409).json({ error: 'User already a member' });
    await db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, user.id, role);
    res.status(201).json({ message: 'Member added', user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  if (!await isProjectAdmin(req.params.id, req.user.id)) return res.status(403).json({ error: 'Admin required' });
  await db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ message: 'Member removed' });
});

module.exports = router;
