const bcrypt = require('bcryptjs');
const { db } = require('./db');

async function seed() {
  const existing = await db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (existing.c > 0) return console.log('Already seeded.');
  console.log('🌱 Seeding demo data...');

  const adminPass = await bcrypt.hash('demo123', 10);
  const memberPass = await bcrypt.hash('demo123', 10);

  const admin = await db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Admin User', 'admin@demo.com', adminPass, 'admin');
  const m1 = await db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Sakshi Singh', 'member@demo.com', memberPass, 'member');
  const m2 = await db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Rahul Dev', 'rahul@demo.com', memberPass, 'member');

  const p1 = await db.prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)').run('Website Redesign', 'Revamp company website with modern UI/UX', admin.lastInsertRowid);
  const p2 = await db.prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)').run('Mobile App MVP', 'Build the first version of the mobile app', admin.lastInsertRowid);

  for (const [pid, uid, role] of [
    [p1.lastInsertRowid, admin.lastInsertRowid, 'admin'],
    [p1.lastInsertRowid, m1.lastInsertRowid, 'member'],
    [p1.lastInsertRowid, m2.lastInsertRowid, 'member'],
    [p2.lastInsertRowid, admin.lastInsertRowid, 'admin'],
    [p2.lastInsertRowid, m1.lastInsertRowid, 'admin'],
  ]) await db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(pid, uid, role);

  const tasks = [
    ['Design homepage mockup', 'Figma mockups for homepage', 'done', 'high', p1.lastInsertRowid, m1.lastInsertRowid, '2026-04-20'],
    ['Implement responsive navbar', 'Mobile-friendly navigation', 'in_progress', 'high', p1.lastInsertRowid, m1.lastInsertRowid, '2026-05-05'],
    ['Write unit tests', 'Jest tests for all endpoints', 'todo', 'medium', p1.lastInsertRowid, m2.lastInsertRowid, '2026-05-10'],
    ['SEO optimization', 'Meta tags and structured data', 'todo', 'low', p1.lastInsertRowid, null, null],
    ['Setup React Native', 'Init project with navigation', 'done', 'high', p2.lastInsertRowid, m1.lastInsertRowid, '2026-04-15'],
    ['Authentication flow', 'Login, signup, token refresh', 'in_progress', 'high', p2.lastInsertRowid, m1.lastInsertRowid, '2026-04-28'],
    ['Dashboard screen UI', 'Build main dashboard', 'todo', 'medium', p2.lastInsertRowid, m2.lastInsertRowid, '2026-05-15'],
  ];
  for (const [title, desc, status, priority, pid, assignee, due] of tasks) {
    await db.prepare('INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(title, desc, status, priority, pid, assignee, admin.lastInsertRowid, due);
  }
  console.log('✅ Demo data seeded! admin@demo.com / demo123');
}

module.exports = seed;
