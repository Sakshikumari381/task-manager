const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// Helper: check if user is project admin or global admin
function isProjectAdmin(projectId, userId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (user.role === 'admin') return true;
  const membership = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, userId);
  return membership?.role === 'admin';
}

// GET /api/projects - get all projects user is a member of (or all if global admin)
router.get('/', authenticate, (req, res) => {
  let projects;
  if (req.user.role === 'admin') {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
      FROM projects p JOIN users u ON p.owner_id = u.id
      ORDER BY p.created_at DESC
    `).all();
  } else {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
    `).all(req.user.id);
  }
  res.json(projects);
});

// POST /api/projects
router.post('/', authenticate, [
  body('name').trim().notEmpty().withMessage('Project name required'),
  body('description').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description } = req.body;
  const result = db.prepare(
    'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
  ).run(name, description || '', req.user.id);

  // Auto-add creator as admin member
  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, req.user.id, 'admin');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', authenticate, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name FROM projects p
    JOIN users u ON p.owner_id = u.id WHERE p.id = ?
  `).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Check access
  if (req.user.role !== 'admin') {
    const member = db.prepare(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role as global_role, pm.role as project_role
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(req.params.id);

  res.json({ ...project, members });
});

// PUT /api/projects/:id
router.put('/:id', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
], (req, res) => {
  if (!isProjectAdmin(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'Project admin access required' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description } = req.body;
  db.prepare('UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?')
    .run(name, description, req.params.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

// DELETE /api/projects/:id
router.delete('/:id', authenticate, (req, res) => {
  if (!isProjectAdmin(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'Project admin access required' });
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members - add member
router.post('/:id/members', authenticate, [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'member']),
], (req, res) => {
  if (!isProjectAdmin(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'Project admin access required' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, role = 'member' } = req.body;
  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, user.id);
  if (existing) return res.status(409).json({ error: 'User already a member' });

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
    .run(req.params.id, user.id, role);

  res.status(201).json({ message: 'Member added', user });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', authenticate, (req, res) => {
  if (!isProjectAdmin(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'Project admin access required' });
  }
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
    .run(req.params.id, req.params.userId);
  res.json({ message: 'Member removed' });
});

module.exports = router;
