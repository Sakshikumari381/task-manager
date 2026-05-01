const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/users', require('./routes/users'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend
const possibleFrontend = [
  path.join(__dirname, '../frontend/dist'),
  path.join(process.cwd(), 'frontend/dist'),
];
let frontendBuild = possibleFrontend.find(p => fs.existsSync(p));

if (frontendBuild) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendBuild, 'index.html'));
    }
  });
}

app.listen(PORT, async () => {
  console.log(`🚀 TaskFlow running on port ${PORT}`);
  // Auto seed demo data
  try {
    const db = require('./db');
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (count === 0) {
      require('./seed');
    }
  } catch(e) { console.error('Seed error:', e.message); }
});

module.exports = app;
