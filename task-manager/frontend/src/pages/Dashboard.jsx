import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
}
function PriorityBadge({ priority }) {
  return <span className={`badge badge-${priority}`}>{priority}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tasks/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/>Loading...</div></div>;

  const { stats, myTasks } = data || {};

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Here's what's happening on your projects</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.total ?? 0}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-value">{stats?.in_progress ?? 0}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{stats?.done ?? 0}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-value">{stats?.todo ?? 0}</div>
          <div className="stat-label">To Do</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">{stats?.overdue ?? 0}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      {stats?.total > 0 && (
        <div className="card" style={{marginBottom: 24}}>
          <div className="card-header">
            <div className="card-title">Progress Overview</div>
            <span style={{fontSize: '0.82rem', color: 'var(--text-2)'}}>
              {Math.round((stats.done / stats.total) * 100)}% complete
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{width: `${Math.round((stats.done / stats.total) * 100)}%`}} />
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <span className="section-title">My Open Tasks</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/tasks')}>View all</button>
        </div>
        {myTasks?.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <h3>All caught up!</h3>
            <p>No tasks assigned to you right now.</p>
          </div>
        ) : (
          <div className="tasks-list">
            {myTasks?.map(task => {
              const isOverdue = task.due_date && isPast(parseISO(task.due_date));
              return (
                <div key={task.id} className={`task-card ${isOverdue ? 'overdue' : ''}`}
                  onClick={() => navigate(`/projects/${task.project_id}`)}>
                  <div className="task-content">
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      <StatusBadge status={task.status} />
                      <PriorityBadge priority={task.priority} />
                      <span className="task-meta-item">📁 {task.project_name}</span>
                      {task.due_date && (
                        <span className={`task-meta-item ${isOverdue ? '' : ''}`}
                          style={{color: isOverdue ? 'var(--red)' : 'var(--text-3)'}}>
                          📅 {isOverdue ? 'Overdue · ' : ''}{formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatDate(date) {
  try { return new Date(date).toLocaleDateString('en-IN', {day:'numeric', month:'short'}); }
  catch { return date; }
}
