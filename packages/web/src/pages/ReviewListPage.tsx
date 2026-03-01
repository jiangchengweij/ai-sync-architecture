import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Review } from '../types';
import { api } from '../utils/api';

const riskColors: Record<string, string> = {
  low: '#27ae60', medium: '#f39c12', high: '#e74c3c',
};

export function ReviewListPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const data = await api.getReviews({ limit: 50 });
      setReviews(data.reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  if (error) return <div style={{ padding: '40px', color: '#e74c3c' }}>{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>待审核列表</h2>
        <button onClick={loadReviews} style={{
          padding: '6px 16px', background: '#3498db', color: '#fff',
          border: 'none', borderRadius: '4px', cursor: 'pointer',
        }}>
          刷新
        </button>
      </div>

      {reviews.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#888', background: '#fff', borderRadius: '8px' }}>
          暂无待审核项
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reviews.map((review) => (
            <div
              key={review.id}
              onClick={() => navigate(`/reviews/${review.id}`)}
              style={{
                background: '#fff', padding: '16px 20px', borderRadius: '8px',
                cursor: 'pointer', border: '1px solid #eee',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{review.changeSummary}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {review.variantName} · {review.affectedFiles.length} 个文件 · {review.changeType}
                </div>
                {review.warnings.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#f39c12', marginTop: '4px' }}>
                    {review.warnings[0]}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {(review.confidence * 100).toFixed(0)}%
                  </div>
                  <div style={{
                    fontSize: '12px', color: riskColors[review.riskLevel],
                    fontWeight: 600, textTransform: 'uppercase',
                  }}>
                    {review.riskLevel}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
