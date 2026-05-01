# ⚡ TaskFlow — Team Task Manager

A full-stack web application for team project and task management with role-based access control.

**Live Demo:** [Deploy to Railway — see below]  
**Demo Credentials:**
- Admin: `admin@demo.com` / `demo123`
- Member: `member@demo.com` / `demo123`

---

## Features

- **Authentication** — JWT-based signup/login with role selection (Admin/Member)
- **Projects** — Create, view, and manage projects; invite team members by email
- **Task Management** — Create tasks with title, description, status, priority, assignee, and due date
- **Role-Based Access Control (RBAC)**:
  - **Global Admin** — Full access to all projects and tasks; can delete anything
  - **Project Admin** — Can manage tasks, members, and settings within their project
  - **Member** — Can view tasks, update status of assigned tasks
- **Dashboard** — Personal task overview with stats: total, in-progress, done, overdue
- **Filters** — Filter tasks by status, priority, and project
- **Overdue Detection** — Visual indicators for tasks past their due date

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Axios, Vite |
| Backend | Node.js, Express.js |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Validation | express-validator |
| Deployment | Railway |

---

## REST API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/auth/me` | Get current user |

### Projects
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/projects` | ✅ | List all accessible projects |
| POST | `/api/projects` | ✅ | Create a project |
| GET | `/api/projects/:id` | ✅ | Get project + members |
| PUT | `/api/projects/:id` | Admin | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project |
| POST | `/api/projects/:id/members` | Admin | Add member by email |
| DELETE | `/api/projects/:id/members/:userId` | Admin | Remove member |

### Tasks
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tasks` | ✅ | List tasks (filterable by status, priority, project) |
| GET | `/api/tasks/dashboard` | ✅ | Dashboard stats + my tasks |
| POST | `/api/tasks` | ✅ | Create a task |
| GET | `/api/tasks/:id` | ✅ | Get task details |
| PUT | `/api/tasks/:id` | Assignee/Admin | Update task |
| DELETE | `/api/tasks/:id` | Admin | Delete task |

---

## Database Schema

```sql
users         — id, name, email, password, role (admin|member)
projects      — id, name, description, owner_id
project_members — project_id, user_id, role (admin|member)
tasks         — id, title, description, status, priority, project_id, assignee_id, created_by, due_date
```

---

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd task-manager

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install

# Start backend (port 5000)
cd ../backend && npm run dev

# Start frontend (port 5173) — in a new terminal
cd ../frontend && npm run dev
```

Open `http://localhost:5173` — demo data is seeded automatically on first run.

---

## Deployment (Railway)

1. Push this repo to GitHub

2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**

3. Select your repository

4. Railway will auto-detect the config from `railway.toml` and:
   - Install dependencies
   - Build the React frontend
   - Start the Express server (which also serves the frontend)

5. Set these **environment variables** in Railway:
   ```
   JWT_SECRET=your_super_secret_key_here
   NODE_ENV=production
   ```

6. Railway assigns a public URL — that's your live app!

> **Note:** SQLite stores data in `taskmanager.db`. For persistent storage across Railway redeploys, add a Railway Volume mounted at `/app`.

---

## Project Structure

```
task-manager/
├── backend/
│   ├── routes/
│   │   ├── auth.js       # Signup, login, /me
│   │   ├── projects.js   # CRUD + member management
│   │   ├── tasks.js      # CRUD + dashboard
│   │   └── users.js      # User listing + role management
│   ├── middleware/
│   │   └── auth.js       # JWT verification, role checks
│   ├── db.js             # SQLite init + schema
│   ├── seed.js           # Demo data seeder
│   └── server.js         # Express app entry
├── frontend/
│   └── src/
│       ├── pages/        # Dashboard, Projects, ProjectDetail, Tasks, Login, Signup
│       ├── components/   # Layout, TaskModal
│       ├── context/      # AuthContext
│       └── styles.css    # Full design system
├── railway.toml          # Railway deployment config
└── README.md
```

---

## Author

Built as a full-stack assignment demonstrating REST API design, JWT authentication, RBAC, and React SPA with a complete CI/CD deployment pipeline.
