import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import type { StatsOverview } from '../types';

const cardStyle = {
  background: '#fff', borderRadius: '8px', padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: '1', minWidth: '200px',
};

export function DashboardPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(() => {
        // Fallback mock stats if endpoint not ready
        setStats({
          totalGroups: 0, totalSyncs: 0, pendingReviews: 0,
          successRate: 0, recentSyncs: [],
        });
      });
  }, []);

  if (!stats) return <div>加载中...</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>概览</h2>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={cardStyle} onClick={() => navigate('/project-groups')} role="button" tabIndex={0}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1a1a2e' }}>{stats.totalGroups}</div>
          <div style={{ color: '#666', marginTop: '4px' }}>项目组</div>
        </div>
        <div style={cardStyle} onClick={() => navigate('/sync')} role="button" tabIndex={0}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f3460' }}>{stats.totalSyncs}</div>
          <div style={{ color: '#666', marginTop: '4px' }}>同步任务</div>
        </div>
        <div style={cardStyle} onClick={() => navigate('/reviews')} role="button" tabIndex={0}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#e94560' }}>{stats.pendingReviews}</div>
          <div style={{ color: '#666', marginTop: '4px' }}>待审核</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0a9396' }}>
            {(stats.successRate * 100).toFixed(0)}%
          </div>
          <div style={{ color: '#666', marginTop: '4px' }}>同步成功率</div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>最近同步</h3>
        {stats.recentSyncs.length === 0 ? (
          <div style={{ color: '#999', padding: '20px', textAlign: 'center' }}>暂无同步记录</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>ID</th>
                <th style={{ padding: '8px' }}>状态</th>
                <th style={{ padding: '8px' }}>时间</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentSyncs.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{s.id.slice(0, 8)}</td>
                  <td style={{ padding: '8px' }}>{s.status}</td>
                  <td style={{ padding: '8px' }}>{new Date(s.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
