const db = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Seeding demo data...');

  // Check if already seeded
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) {
    console.log('✅ Already seeded, skipping.');
    return;
  }

  const adminPass = await bcrypt.hash('demo123', 10);
  const memberPass = await bcrypt.hash('demo123', 10);

  // Create users
  const admin = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run('Admin User', 'admin@demo.com', adminPass, 'admin');
  const member1 = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run('Sakshi Singh', 'member@demo.com', memberPass, 'member');
  const member2 = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run('Rahul Dev', 'rahul@demo.com', memberPass, 'member');

  // Create projects
  const project1 = db.prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)')
    .run('Website Redesign', 'Revamp the company website with modern UI/UX', admin.lastInsertRowid);
  const project2 = db.prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)')
    .run('Mobile App MVP', 'Build the first version of the mobile application', admin.lastInsertRowid);

  // Add members to projects
  const addMember = db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)');
  addMember.run(project1.lastInsertRowid, admin.lastInsertRowid, 'admin');
  addMember.run(project1.lastInsertRowid, member1.lastInsertRowid, 'member');
  addMember.run(project1.lastInsertRowid, member2.lastInsertRowid, 'member');
  addMember.run(project2.lastInsertRowid, admin.lastInsertRowid, 'admin');
  addMember.run(project2.lastInsertRowid, member1.lastInsertRowid, 'admin');

  // Create tasks
  const tasks = [
    { title: 'Design new homepage mockup', desc: 'Create Figma mockups for the homepage redesign', status: 'done', priority: 'high', project: project1.lastInsertRowid, assignee: member1.lastInsertRowid, due: '2026-04-20' },
    { title: 'Implement responsive navbar', desc: 'Build mobile-friendly navigation component', status: 'in_progress', priority: 'high', project: project1.lastInsertRowid, assignee: member1.lastInsertRowid, due: '2026-05-05' },
    { title: 'Write unit tests for API', desc: 'Add Jest tests for all REST endpoints', status: 'todo', priority: 'medium', project: project1.lastInsertRowid, assignee: member2.lastInsertRowid, due: '2026-05-10' },
    { title: 'SEO optimization', desc: 'Add meta tags and structured data', status: 'todo', priority: 'low', project: project1.lastInsertRowid, assignee: null, due: null },
    { title: 'Setup React Native project', desc: 'Initialize project with navigation and state management', status: 'done', priority: 'high', project: project2.lastInsertRowid, assignee: member1.lastInsertRowid, due: '2026-04-15' },
    { title: 'Authentication flow', desc: 'Implement login, signup, and token refresh', status: 'in_progress', priority: 'high', project: project2.lastInsertRowid, assignee: member1.lastInsertRowid, due: '2026-04-28' },
    { title: 'Dashboard screen UI', desc: 'Build the main dashboard screen', status: 'todo', priority: 'medium', project: project2.lastInsertRowid, assignee: member2.lastInsertRowid, due: '2026-05-15' },
    { title: 'API integration layer', desc: 'Connect frontend to backend REST APIs', status: 'todo', priority: 'medium', project: project2.lastInsertRowid, assignee: null, due: '2026-05-20' },
  ];

  const insertTask = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  tasks.forEach(t => insertTask.run(t.title, t.desc, t.status, t.priority, t.project, t.assignee, admin.lastInsertRowid, t.due));

  console.log('✅ Demo data seeded successfully!');
  console.log('   Admin: admin@demo.com / demo123');
  console.log('   Member: member@demo.com / demo123');
}

seed().catch(console.error);
