import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import type { ProjectGroup } from '../types';

export function ProjectGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<ProjectGroup | null>(null);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [variantForm, setVariantForm] = useState({ name: '', gitUrl: '', customizationNotes: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => {
    if (!id) return;
    api.getProjectGroup(id).then(setGroup).catch((e) => setError(e.message));
  };

  useEffect(load, [id]);

  const handleAddVariant = async () => {
    if (!id) return;
    try {
      setError('');
      await api.addVariant(id, variantForm);
      setShowAddVariant(false);
      setVariantForm({ name: '', gitUrl: '', customizationNotes: '' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('确定删除此项目组？')) return;
    try {
      await api.deleteProjectGroup(id);
      navigate('/project-groups');
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!group) return <div>加载中...</div>;

  const baseProject = group.projects?.find((p) => p.type === 'base');
  const variants = group.projects?.filter((p) => p.type === 'variant') || [];
  const inputStyle = {
    width: '100%', padding: '8px', border: '1px solid #ddd',
    borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' as const,
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={() => navigate('/project-groups')} style={{ background: 'none', border: 'none', color: '#0f3460', cursor: 'pointer', padding: 0, marginBottom: '8px' }}>
            &larr; 返回列表
          </button>
          <h2 style={{ marginTop: '4px' }}>{group.name}</h2>
          <p style={{ color: '#666', marginTop: '-8px' }}>{group.description}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate(`/sync?groupId=${id}`)} style={{ background: '#0f3460', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
            触发同步
          </button>
          <button onClick={handleDelete} style={{ background: '#e94560', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
            删除
          </button>
        </div>
      </div>
      {error && <div style={{ color: '#e94560', marginBottom: '12px' }}>{error}</div>}

      <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>Base 项目</h3>
        {baseProject ? (
          <div>
            <div style={{ fontWeight: 'bold' }}>{baseProject.name}</div>
            <div style={{ color: '#666', fontSize: '13px' }}>{baseProject.gitUrl} ({baseProject.gitBranch})</div>
          </div>
        ) : <div style={{ color: '#999' }}>无 Base 项目</div>}
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ marginTop: 0 }}>变体项目 ({variants.length})</h3>
          <button onClick={() => setShowAddVariant(!showAddVariant)} style={{ background: '#0a9396', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
            {showAddVariant ? '取消' : '添加变体'}
          </button>
        </div>
        {showAddVariant && (
          <div style={{ display: 'grid', gap: '10px', maxWidth: '400px', marginBottom: '16px', padding: '12px', background: '#f9f9f9', borderRadius: '6px' }}>
            <input style={inputStyle} placeholder="变体名称" value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} />
            <input style={inputStyle} placeholder="Git URL" value={variantForm.gitUrl} onChange={(e) => setVariantForm({ ...variantForm, gitUrl: e.target.value })} />
            <input style={inputStyle} placeholder="定制说明 (可选)" value={variantForm.customizationNotes} onChange={(e) => setVariantForm({ ...variantForm, customizationNotes: e.target.value })} />
            <button onClick={handleAddVariant} style={{ background: '#0a9396', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>添加</button>
          </div>
        )}
        {variants.map((v) => (
          <div key={v.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold' }}>{v.name}</div>
            <div style={{ color: '#666', fontSize: '13px' }}>{v.gitUrl} ({v.gitBranch})</div>
          </div>
        ))}
        {variants.length === 0 && <div style={{ color: '#999', padding: '16px', textAlign: 'center' }}>暂无变体项目</div>}
      </div>
    </div>
  );
}
