const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

function hasProjectAccess(projectId, userId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (user.role === 'admin') return true;
  return !!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

function isProjectAdmin(projectId, userId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (user.role === 'admin') return true;
  const m = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
  return m?.role === 'admin';
}

// GET /api/tasks?project_id=&status=&assignee_id=
router.get('/', authenticate, (req, res) => {
  const { project_id, status, assignee_id } = req.query;

  let query = `
    SELECT t.*, 
      u.name as assignee_name, u.email as assignee_email,
      c.name as created_by_name,
      p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.created_by = c.id
    JOIN projects p ON t.project_id = p.id
  `;

  const conditions = [];
  const params = [];

  if (req.user.role !== 'admin') {
    conditions.push('t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)');
    params.push(req.user.id);
  }
  if (project_id) { conditions.push('t.project_id = ?'); params.push(project_id); }
  if (status) { conditions.push('t.status = ?'); params.push(status); }
  if (assignee_id) { conditions.push('t.assignee_id = ?'); params.push(assignee_id); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY t.created_at DESC';

  const tasks = db.prepare(query).all(...params);
  res.json(tasks);
});

// GET /api/tasks/dashboard - summary for logged-in user
router.get('/dashboard', authenticate, (req, res) => {
  const uid = req.user.id;
  const isAdmin = req.user.role === 'admin';

  const scopeFilter = isAdmin ? '' : 'AND t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)';
  const scopeParams = isAdmin ? [] : [uid];

  const total = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE 1=1 ${scopeFilter}`).get(...scopeParams);
  const todo = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE status='todo' ${scopeFilter}`).get(...scopeParams);
  const in_progress = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE status='in_progress' ${scopeFilter}`).get(...scopeParams);
  const done = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE status='done' ${scopeFilter}`).get(...scopeParams);
  const overdue = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE status != 'done' AND due_date < date('now') AND due_date IS NOT NULL ${scopeFilter}`).get(...scopeParams);
  const myTasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assignee_name
    FROM tasks t JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.assignee_id = ? AND t.status != 'done'
    ORDER BY t.due_date ASC NULLS LAST LIMIT 10
  `).all(uid);

  res.json({
    stats: {
      total: total.count,
      todo: todo.count,
      in_progress: in_progress.count,
      done: done.count,
      overdue: overdue.count
    },
    myTasks
  });
});

// POST /api/tasks
router.post('/', authenticate, [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('project_id').isInt().withMessage('Valid project_id required'),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('due_date').optional().isISO8601().withMessage('Invalid date'),
  body('assignee_id').optional().isInt(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, project_id, status = 'todo', priority = 'medium', assignee_id, due_date } = req.body;

  if (!hasProjectAccess(project_id, req.user.id)) {
    return res.status(403).json({ error: 'No access to this project' });
  }

  // Only admins or project admins can assign to others
  if (assignee_id && assignee_id != req.user.id && !isProjectAdmin(project_id, req.user.id)) {
    return res.status(403).json({ error: 'Only project admins can assign tasks to others' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, description, project_id, status, priority, assignee_id, created_by, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || '', project_id, status, priority, assignee_id || null, req.user.id, due_date || null);

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, p.name as project_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    JOIN projects p ON t.project_id = p.id WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(task);
});

// GET /api/tasks/:id
router.get('/:id', authenticate, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
      c.name as created_by_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.created_by = c.id
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!hasProjectAccess(task.project_id, req.user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(task);
});

// PUT /api/tasks/:id
router.put('/:id', authenticate, [
  body('title').optional().trim().notEmpty(),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('due_date').optional().isISO8601(),
  body('assignee_id').optional({ nullable: true }).isInt(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!hasProjectAccess(task.project_id, req.user.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { title, description, status, priority, assignee_id, due_date } = req.body;

  // Members can only update status of their own tasks
  if (!isProjectAdmin(task.project_id, req.user.id)) {
    if (task.assignee_id !== req.user.id && task.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Can only update your own tasks' });
    }
    if (assignee_id !== undefined || title !== undefined) {
      return res.status(403).json({ error: 'Members can only update status/description' });
    }
  }

  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      assignee_id = CASE WHEN ? IS NOT NULL THEN ? ELSE assignee_id END,
      due_date = COALESCE(?, due_date),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, status, priority, assignee_id, assignee_id, due_date, req.params.id);

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, p.name as project_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    JOIN projects p ON t.project_id = p.id WHERE t.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!isProjectAdmin(task.project_id, req.user.id)) {
    return res.status(403).json({ error: 'Only project admins can delete tasks' });
  }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
