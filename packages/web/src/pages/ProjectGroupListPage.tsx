import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import type { ProjectGroup } from '../types';

export function ProjectGroupListPage() {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', baseName: '', baseGitUrl: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => {
    api.getProjectGroups().then((res) => setGroups(res.items)).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    try {
      setError('');
      await api.createProjectGroup({
        name: form.name,
        description: form.description,
        baseProject: { name: form.baseName, gitUrl: form.baseGitUrl },
      });
      setShowCreate(false);
      setForm({ name: '', description: '', baseName: '', baseGitUrl: '' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px', border: '1px solid #ddd',
    borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' as const,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>项目组</h2>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          background: '#1a1a2e', color: '#fff', border: 'none',
          padding: '8px 16px', borderRadius: '4px', cursor: 'pointer',
        }}>
          {showCreate ? '取消' : '创建项目组'}
        </button>
      </div>
      {error && <div style={{ color: '#e94560', marginBottom: '12px' }}>{error}</div>}
      {showCreate && (
        <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0 }}>创建项目组</h3>
          <div style={{ display: 'grid', gap: '12px', maxWidth: '500px' }}>
            <input style={inputStyle} placeholder="项目组名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input style={inputStyle} placeholder="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input style={inputStyle} placeholder="Base 项目名称" value={form.baseName} onChange={(e) => setForm({ ...form, baseName: e.target.value })} />
            <input style={inputStyle} placeholder="Base Git URL" value={form.baseGitUrl} onChange={(e) => setForm({ ...form, baseGitUrl: e.target.value })} />
            <button onClick={handleCreate} style={{ background: '#0a9396', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>
              创建
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px' }}>
        {groups.map((g) => (
          <div key={g.id} onClick={() => navigate(`/project-groups/${g.id}`)}
            style={{ background: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{g.name}</div>
                <div style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>{g.description}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', color: '#666' }}>{g.projects?.length || 0} 个项目</div>
                <div style={{ fontSize: '13px', color: '#999' }}>{g._count?.syncTasks || 0} 次同步</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {g.projects?.map((p) => (
                <span key={p.id} style={{
                  fontSize: '12px', padding: '2px 8px', borderRadius: '10px',
                  background: p.type === 'base' ? '#e0f2fe' : '#fef3c7',
                  color: p.type === 'base' ? '#0369a1' : '#92400e',
                }}>
                  {p.name} ({p.type})
                </span>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: '40px' }}>暂无项目组</div>}
      </div>
    </div>
  );
}
