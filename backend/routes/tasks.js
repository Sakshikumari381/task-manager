const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

async function hasProjectAccess(projectId, userId) {
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (user && user.role === 'admin') return true;
  const m = await db.prepare('SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
  return !!m;
}

async function isProjectAdmin(projectId, userId) {
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (user && user.role === 'admin') return true;
  const m = await db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
  return m?.role === 'admin';
}

// Dashboard must come before /:id
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const uid = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const scopeSQL = isAdmin ? '' : 'AND t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)';
    const sp = isAdmin ? [] : [uid];

    const total = await db.prepare(`SELECT COUNT(*) as c FROM tasks t WHERE 1=1 ${scopeSQL}`).get(...sp);
    const todo = await db.prepare(`SELECT COUNT(*) as c FROM tasks t WHERE status='todo' ${scopeSQL}`).get(...sp);
    const inprog = await db.prepare(`SELECT COUNT(*) as c FROM tasks t WHERE status='in_progress' ${scopeSQL}`).get(...sp);
    const done = await db.prepare(`SELECT COUNT(*) as c FROM tasks t WHERE status='done' ${scopeSQL}`).get(...sp);
    const overdue = await db.prepare(`SELECT COUNT(*) as c FROM tasks t WHERE status != 'done' AND due_date < date('now') AND due_date IS NOT NULL ${scopeSQL}`).get(...sp);

    const myTasks = await db.prepare(`
      SELECT t.*, p.name as project_name, u.name as assignee_name
      FROM tasks t JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.assignee_id = ? AND t.status != 'done'
      ORDER BY t.due_date ASC LIMIT 10
    `).all(uid);

    res.json({
      stats: { total: total.c, todo: todo.c, in_progress: inprog.c, done: done.c, overdue: overdue.c },
      myTasks
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { project_id, status, assignee_id } = req.query;
    let query = `
      SELECT t.*, u.name as assignee_name, u.email as assignee_email,
        c.name as created_by_name, p.name as project_name
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
    const tasks = await db.all(query, params);
    res.json(tasks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, [
  body('title').trim().notEmpty(),
  body('project_id').isInt(),
  body('status').optional().isIn(['todo','in_progress','done']),
  body('priority').optional().isIn(['low','medium','high']),
  body('due_date').optional({ nullable:true }).isISO8601(),
  body('assignee_id').optional({ nullable:true }).isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { title, description, project_id, status='todo', priority='medium', assignee_id, due_date } = req.body;
  try {
    if (!await hasProjectAccess(project_id, req.user.id)) return res.status(403).json({ error: 'No access' });
    const result = await db.prepare(
      `INSERT INTO tasks (title, description, project_id, status, priority, assignee_id, created_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(title, description||'', project_id, status, priority, assignee_id||null, req.user.id, due_date||null);
    const task = await db.prepare(`
      SELECT t.*, u.name as assignee_name, p.name as project_name
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
      JOIN projects p ON t.project_id = p.id WHERE t.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const task = await db.prepare(`
      SELECT t.*, u.name as assignee_name, c.name as created_by_name, p.name as project_name
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
      JOIN users c ON t.created_by = c.id JOIN projects p ON t.project_id = p.id WHERE t.id = ?
    `).get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (!await hasProjectAccess(task.project_id, req.user.id)) return res.status(403).json({ error: 'Access denied' });
    res.json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (!await hasProjectAccess(task.project_id, req.user.id)) return res.status(403).json({ error: 'Access denied' });
    const { title, description, status, priority, assignee_id, due_date } = req.body;
    await db.prepare(`
      UPDATE tasks SET
        title = COALESCE(?, title), description = COALESCE(?, description),
        status = COALESCE(?, status), priority = COALESCE(?, priority),
        assignee_id = CASE WHEN ? IS NOT NULL THEN ? ELSE assignee_id END,
        due_date = COALESCE(?, due_date), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title??null, description??null, status??null, priority??null, assignee_id??null, assignee_id??null, due_date??null, req.params.id);
    const updated = await db.prepare(`
      SELECT t.*, u.name as assignee_name, p.name as project_name
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
      JOIN projects p ON t.project_id = p.id WHERE t.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    if (!await isProjectAdmin(task.project_id, req.user.id)) return res.status(403).json({ error: 'Admin required' });
    await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
