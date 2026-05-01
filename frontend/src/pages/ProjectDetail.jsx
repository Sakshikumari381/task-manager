import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import { isPast, parseISO } from 'date-fns';

function Badge({ type, value }) {
  return <span className={`badge badge-${value}`}>{value.replace('_', ' ')}</span>;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [memberError, setMemberError] = useState('');

  const isAdmin = user?.role === 'admin' ||
    project?.members?.find(m => m.id === user?.id)?.project_role === 'admin';

  const loadProject = () => api.get(`/projects/${id}`).then(r => setProject(r.data));
  const loadTasks = () => api.get(`/tasks?project_id=${id}`).then(r => setTasks(r.data));

  useEffect(() => {
    Promise.all([loadProject(), loadTasks()]).finally(() => setLoading(false));
  }, [id]);

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    await api.delete(`/tasks/${taskId}`);
    loadTasks();
  };

  const handleStatusChange = async (task, status) => {
    await api.put(`/tasks/${task.id}`, { status });
    loadTasks();
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setMemberError('');
    try {
      await api.post(`/projects/${id}/members`, { email: memberEmail, role: memberRole });
      setMemberEmail(''); setShowMemberModal(false); loadProject();
    } catch (err) {
      setMemberError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    await api.delete(`/projects/${id}/members/${userId}`);
    loadProject();
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/>Loading...</div></div>;
  if (!project) return <div className="page"><p>Project not found</p></div>;

  const filteredTasks = tasks.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  const byStatus = (s) => filteredTasks.filter(t => t.status === s);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" style={{marginBottom:8}} onClick={() => navigate('/projects')}>
            ← Projects
          </button>
          <h1 className="page-title">{project.name}</h1>
          {project.description && <p className="page-subtitle">{project.description}</p>}
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { setEditTask(null); setShowTaskModal(true); }}>
            + Add Task
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{display:'flex', gap:12, marginBottom:24, flexWrap:'wrap'}}>
        {[['All',tasks.length,''], ['To Do', byStatus('todo').length, 'var(--text-2)'],
          ['In Progress', byStatus('in_progress').length, 'var(--yellow)'],
          ['Done', byStatus('done').length, 'var(--green)'],
          ['Overdue', tasks.filter(t => t.due_date && isPast(parseISO(t.due_date)) && t.status !== 'done').length, 'var(--red)']
        ].map(([label, count, color]) => (
          <div key={label} className="card" style={{padding:'12px 18px', minWidth:90}}>
            <div style={{fontSize:'1.4rem', fontWeight:700, color: color || 'var(--accent)', lineHeight:1}}>{count}</div>
            <div style={{fontSize:'0.75rem', color:'var(--text-3)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.05em'}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid var(--border)', paddingBottom:0}}>
        {['tasks','members'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="btn btn-ghost"
            style={{
              borderRadius:'6px 6px 0 0', borderBottom: activeTab===tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab===tab ? 'var(--accent)' : 'var(--text-2)',
              paddingBottom:10, textTransform:'capitalize'
            }}>
            {tab} {tab === 'tasks' ? `(${tasks.length})` : `(${project.members?.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'tasks' && (
        <>
          <div className="filter-bar">
            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <select className="form-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {!isAdmin && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditTask(null); setShowTaskModal(true); }}>
                + Add Task
              </button>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No tasks found</h3>
              <p>Add a task to get started</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => {
                    const overdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done';
                    return (
                      <tr key={task.id}>
                        <td>
                          <div style={{fontWeight:600, fontSize:'0.9rem'}}>{task.title}</div>
                          {task.description && <div style={{fontSize:'0.78rem', color:'var(--text-3)', marginTop:2}}>{task.description}</div>}
                        </td>
                        <td>
                          <select className="form-select" style={{width:'auto', padding:'4px 8px', fontSize:'0.8rem'}}
                            value={task.status}
                            onChange={e => handleStatusChange(task, e.target.value)}
                            disabled={!isAdmin && task.assignee_id !== user?.id && task.created_by !== user?.id}>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        </td>
                        <td><Badge type="priority" value={task.priority} /></td>
                        <td>
                          {task.assignee_name ? (
                            <div style={{display:'flex', alignItems:'center', gap:7}}>
                              <div className="avatar" style={{width:24, height:24, fontSize:'0.65rem'}}>
                                {task.assignee_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                              </div>
                              <span style={{fontSize:'0.85rem'}}>{task.assignee_name}</span>
                            </div>
                          ) : <span style={{color:'var(--text-3)', fontSize:'0.82rem'}}>Unassigned</span>}
                        </td>
                        <td>
                          {task.due_date ? (
                            <span style={{fontSize:'0.82rem', color: overdue ? 'var(--red)' : 'var(--text-2)'}}>
                              {overdue && '⚠️ '}{new Date(task.due_date).toLocaleDateString('en-IN', {day:'numeric', month:'short'})}
                            </span>
                          ) : <span style={{color:'var(--text-3)', fontSize:'0.82rem'}}>—</span>}
                        </td>
                        <td>
                          <div style={{display:'flex', gap:6}}>
                            {(isAdmin || task.assignee_id === user?.id || task.created_by === user?.id) && (
                              <button className="btn btn-secondary btn-sm" onClick={() => { setEditTask(task); setShowTaskModal(true); }}>Edit</button>
                            )}
                            {isAdmin && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(task.id)}>Del</button>
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
        </>
      )}

      {activeTab === 'members' && (
        <div>
          {isAdmin && (
            <div style={{marginBottom:16}}>
              <button className="btn btn-primary" onClick={() => setShowMemberModal(true)}>+ Add Member</button>
            </div>
          )}
          <div className="card">
            {project.members?.map(m => (
              <div key={m.id} className="member-item">
                <div className="avatar">{m.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
                <div className="member-info">
                  <div className="member-name">{m.name} {m.id === user?.id && <span style={{color:'var(--text-3)', fontSize:'0.78rem'}}>(you)</span>}</div>
                  <div className="member-email">{m.email}</div>
                </div>
                <span className={`badge badge-${m.project_role}`}>{m.project_role}</span>
                {isAdmin && m.id !== user?.id && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.id)}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showTaskModal && (
        <TaskModal
          task={editTask}
          projectId={id}
          onClose={() => { setShowTaskModal(false); setEditTask(null); }}
          onSave={() => { setShowTaskModal(false); setEditTask(null); loadTasks(); }}
        />
      )}

      {showMemberModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowMemberModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Member</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMemberModal(false)}>✕</button>
            </div>
            {memberError && <div className="alert alert-error">{memberError}</div>}
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)} required placeholder="user@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Project Role</label>
                <select className="form-select" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMemberModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
