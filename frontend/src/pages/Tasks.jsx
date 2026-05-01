import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import { isPast, parseISO } from 'date-fns';

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '', project_id: '' });
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);

  const loadTasks = () => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.project_id) params.set('project_id', filters.project_id);
    return api.get(`/tasks?${params}`).then(r => setTasks(r.data));
  };

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadTasks().finally(() => setLoading(false));
  }, [filters]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    await api.delete(`/tasks/${id}`);
    loadTasks();
  };

  const handleStatusChange = async (task, status) => {
    await api.put(`/tasks/${task.id}`, { status });
    loadTasks();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">All Tasks</h1>
          <p className="page-subtitle">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditTask(null); setShowModal(true); }}>
          + New Task
        </button>
      </div>

      <div className="filter-bar">
        <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}>
          <option value="">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select className="form-select" value={filters.priority} onChange={e => setFilters(f => ({...f, priority: e.target.value}))}>
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="form-select" value={filters.project_id} onChange={e => setFilters(f => ({...f, project_id: e.target.value}))}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(filters.status || filters.priority || filters.project_id) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', priority: '', project_id: '' })}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/>Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>No tasks found</h3>
          <p>Create a task or adjust your filters</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const overdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done';
                const canEdit = user?.role === 'admin' || task.assignee_id === user?.id || task.created_by === user?.id;
                return (
                  <tr key={task.id} style={overdue ? {background:'rgba(248,113,113,0.04)'} : {}}>
                    <td style={{maxWidth:240}}>
                      <div style={{fontWeight:600, fontSize:'0.9rem'}} className="truncate">{task.title}</div>
                      {task.description && (
                        <div style={{fontSize:'0.75rem', color:'var(--text-3)', marginTop:2}} className="truncate">
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" style={{padding:'3px 7px', fontFamily:'inherit', fontSize:'0.82rem'}}
                        onClick={() => navigate(`/projects/${task.project_id}`)}>
                        {task.project_name}
                      </button>
                    </td>
                    <td>
                      <select className="form-select" style={{width:'auto', padding:'4px 8px', fontSize:'0.8rem'}}
                        value={task.status}
                        onChange={e => handleStatusChange(task, e.target.value)}
                        disabled={!canEdit}>
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </td>
                    <td><span className={`badge badge-${task.priority}`}>{task.priority}</span></td>
                    <td style={{fontSize:'0.85rem'}}>
                      {task.assignee_name || <span style={{color:'var(--text-3)'}}>—</span>}
                    </td>
                    <td>
                      {task.due_date ? (
                        <span style={{fontSize:'0.82rem', color: overdue ? 'var(--red)' : 'var(--text-2)'}}>
                          {overdue && '⚠ '}{new Date(task.due_date).toLocaleDateString('en-IN', {day:'numeric', month:'short'})}
                        </span>
                      ) : <span style={{color:'var(--text-3)'}}>—</span>}
                    </td>
                    <td>
                      <div style={{display:'flex', gap:6}}>
                        {canEdit && (
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditTask(task); setShowModal(true); }}>Edit</button>
                        )}
                        {user?.role === 'admin' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(task.id)}>Del</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <TaskModal
          task={editTask}
          projects={projects}
          onClose={() => { setShowModal(false); setEditTask(null); }}
          onSave={() => { setShowModal(false); setEditTask(null); loadTasks(); }}
        />
      )}
    </div>
  );
}
