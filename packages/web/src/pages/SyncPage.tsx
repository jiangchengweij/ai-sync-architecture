import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useSyncEvents } from '../hooks/useSyncEvents';
import type { ProjectGroup, SyncTask } from '../types';

export function SyncPage() {
  const [searchParams] = useSearchParams();
  const initialGroupId = searchParams.get('groupId') || '';
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [commitHash, setCommitHash] = useState('');
  const [syncTask, setSyncTask] = useState<SyncTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useSyncEvents({
    projectGroupId: selectedGroupId,
    onSyncProgress: (data) => {
      if (syncTask && data.syncId === syncTask.syncId) {
        api.getSyncStatus(data.syncId).then(setSyncTask);
      }
    },
    onSyncCompleted: (data) => {
      if (syncTask && data.syncId === syncTask.syncId) {
        api.getSyncStatus(data.syncId).then(setSyncTask);
      }
    },
  });

  useEffect(() => {
    api.getProjectGroups().then((res) => setGroups(res.items)).catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    if (!selectedGroupId || !commitHash) return;
    try {
      setLoading(true);
      setError('');
      const result = await api.analyzeSync(selectedGroupId, commitHash);
      setSyncTask(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!syncTask) return;
    try {
      setLoading(true);
      const variantIds = syncTask.variants.map((v) => v.variantId);
      await api.generateSync(syncTask.syncId, variantIds);
      const updated = await api.getSyncStatus(syncTask.syncId);
      setSyncTask(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const handleExecute = async (approvedVariants: string[]) => {
    if (!syncTask) return;
    try {
      setLoading(true);
      await api.executeSync(syncTask.syncId, approvedVariants, { createPr: true });
      const updated = await api.getSyncStatus(syncTask.syncId);
      setSyncTask(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    pending: '#999', analyzing: '#0f3460', analyzed: '#0a9396',
    generating: '#0f3460', generated: '#0a9396', executing: '#e76f51',
    completed: '#2a9d8f', failed: '#e94560', partial: '#e9c46a',
  };

  const selectStyle = {
    padding: '8px', border: '1px solid #ddd', borderRadius: '4px',
    fontSize: '14px', minWidth: '200px',
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>同步操作</h2>
      {error && <div style={{ color: '#e94560', marginBottom: '12px' }}>{error}</div>}

      <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>触发分析</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>项目组</label>
            <select style={selectStyle} value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
              <option value="">选择项目组</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px' }}>Commit Hash</label>
            <input style={{ ...selectStyle, minWidth: '300px' }} placeholder="e.g. abc1234" value={commitHash} onChange={(e) => setCommitHash(e.target.value)} />
          </div>
          <button onClick={handleAnalyze} disabled={loading || !selectedGroupId || !commitHash}
            style={{ background: '#1a1a2e', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '4px', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '处理中...' : '开始分析'}
          </button>
        </div>
      </div>
      {syncTask && (
        <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ marginTop: 0 }}>
              同步任务
              <span style={{ fontSize: '13px', fontFamily: 'monospace', marginLeft: '8px', color: '#999' }}>{syncTask.syncId.slice(0, 8)}</span>
            </h3>
            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '13px', background: (statusColor[syncTask.status] || '#999') + '20', color: statusColor[syncTask.status] || '#999' }}>
              {syncTask.status}
            </span>
          </div>

          {syncTask.progress && (
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '13px', color: '#666' }}>
              <span>总计: {syncTask.progress.total}</span>
              <span style={{ color: '#2a9d8f' }}>完成: {syncTask.progress.completed}</span>
              <span style={{ color: '#e94560' }}>失败: {syncTask.progress.failed}</span>
              <span>待处理: {syncTask.progress.pending}</span>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>变体</th>
                <th style={{ padding: '8px' }}>状态</th>
                <th style={{ padding: '8px' }}>置信度</th>
                <th style={{ padding: '8px' }}>风险</th>
                <th style={{ padding: '8px' }}>分支 / PR</th>
              </tr>
            </thead>
            <tbody>
              {syncTask.variants.map((v) => (
                <tr key={v.variantId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{v.variantName}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ color: statusColor[v.status] || '#999' }}>{v.status}</span>
                  </td>
                  <td style={{ padding: '8px' }}>{(v.confidence * 100).toFixed(0)}%</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '12px',
                      background: v.riskLevel === 'low' ? '#d1fae5' : v.riskLevel === 'high' ? '#fee2e2' : '#fef3c7',
                      color: v.riskLevel === 'low' ? '#065f46' : v.riskLevel === 'high' ? '#991b1b' : '#92400e',
                    }}>{v.riskLevel}</span>
                  </td>
                  <td style={{ padding: '8px', fontSize: '13px' }}>
                    {v.branchName && <span style={{ fontFamily: 'monospace' }}>{v.branchName}</span>}
                    {v.prUrl && <a href={v.prUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '8px' }}>PR</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            {syncTask.status === 'analyzed' && (
              <button onClick={handleGenerate} disabled={loading}
                style={{ background: '#0f3460', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                生成补丁
              </button>
            )}
            {syncTask.status === 'generated' && (
              <button onClick={() => handleExecute(syncTask.variants.map((v) => v.variantId))} disabled={loading}
                style={{ background: '#0a9396', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                执行同步 (全部)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
