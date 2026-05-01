const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'taskmanager.db');

let _db = null;

// Persist to disk every 10 seconds and on writes
let _dirty = false;
function persist() {
  if (_dirty && _db) {
    try {
      const data = _db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
      _dirty = false;
    } catch(e) { console.error('DB persist error:', e.message); }
  }
}
setInterval(persist, 5000);
process.on('exit', persist);
process.on('SIGINT', () => { persist(); process.exit(); });
process.on('SIGTERM', () => { persist(); process.exit(); });

async function getDB() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }
  return _db;
}

function sqlJsRun(sqlDb, sql, params = []) {
  sqlDb.run(sql, params);
  _dirty = true;
  return { lastInsertRowid: sqlDb.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] ?? null };
}

function sqlJsGet(sqlDb, sql, params = []) {
  const stmt = sqlDb.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

function sqlJsAll(sqlDb, sql, params = []) {
  const stmt = sqlDb.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

class Statement {
  constructor(sql) { this.sql = sql; }
  async run(...args) {
    const p = args.flat();
    const sqlDb = await getDB();
    return sqlJsRun(sqlDb, this.sql, p);
  }
  async get(...args) {
    const p = args.flat();
    const sqlDb = await getDB();
    return sqlJsGet(sqlDb, this.sql, p);
  }
  async all(...args) {
    const p = args.flat();
    const sqlDb = await getDB();
    return sqlJsAll(sqlDb, this.sql, p);
  }
}

const db = {
  prepare: (sql) => new Statement(sql),
  async exec(sql) {
    const sqlDb = await getDB();
    sqlDb.exec(sql);
    _dirty = true;
  },
  async run(sql, params = []) {
    const sqlDb = await getDB();
    return sqlJsRun(sqlDb, sql, params);
  },
  async get(sql, params = []) {
    const sqlDb = await getDB();
    return sqlJsGet(sqlDb, sql, params);
  },
  async all(sql, params = []) {
    const sqlDb = await getDB();
    return sqlJsAll(sqlDb, sql, params);
  },
};

async function initDB() {
  const sqlDb = await getDB();
  sqlDb.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at DATETIME DEFAULT (datetime('now'))
  )`);
  sqlDb.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  )`);
  sqlDb.run(`CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  sqlDb.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    project_id INTEGER NOT NULL,
    assignee_id INTEGER,
    created_by INTEGER NOT NULL,
    due_date TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);
  _dirty = true;
  persist();
  console.log('✅ Database initialized');
}

module.exports = { db, initDB };
