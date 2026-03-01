import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReviewDetail } from '../types';
import { api } from '../utils/api';
import { DiffViewer } from '../components/DiffViewer';

export function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (id) loadReview(id);
  }, [id]);

  const loadReview = async (reviewId: string) => {
    setLoading(true);
    try {
      const data = await api.getReviewDetail(reviewId);
      setReview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.approveReview(id);
      navigate('/reviews');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await api.rejectReview(id, rejectReason);
      navigate('/reviews');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  if (error) return <div style={{ padding: '40px', color: '#e74c3c' }}>{error}</div>;
  if (!review) return null;

  const riskColor = { low: '#27ae60', medium: '#f39c12', high: '#e74c3c' }[review.riskLevel];

  return (
    <div>
      <button onClick={() => navigate('/reviews')} style={{
        background: 'none', border: 'none', color: '#3498db',
        cursor: 'pointer', padding: 0, marginBottom: '16px', fontSize: '14px',
      }}>
        &larr; 返回列表
      </button>

      <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 8px' }}>{review.changeSummary}</h2>
            <div style={{ color: '#666', fontSize: '14px' }}>
              变体: {review.variantName} · 类型: {review.changeType} · 提交: {review.baseChange.commitHash.slice(0, 7)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{(review.confidence * 100).toFixed(0)}%</div>
            <div style={{ color: riskColor, fontWeight: 600, fontSize: '14px' }}>
              {review.riskLevel.toUpperCase()} RISK
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px', fontSize: '14px', color: '#444' }}>
          {review.adaptedChange.explanation}
        </div>

        {review.adaptedChange.risks.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <strong style={{ fontSize: '13px' }}>风险:</strong>
            <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
              {review.adaptedChange.risks.map((r, i) => (
                <li key={i} style={{ fontSize: '13px', color: '#e67e22' }}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {review.adaptedChange.files.map((file, i) => (
        <div key={i} style={{ background: '#fff', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>{file.path}</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{file.explanation}</div>
          <DiffViewer diff={file.diff} />
        </div>
      ))}

      <div style={{
        background: '#fff', borderRadius: '8px', padding: '20px',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
      }}>
        {showRejectForm ? (
          <div style={{ flex: 1 }}>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因..."
              style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()} style={{
                padding: '8px 20px', background: '#e74c3c', color: '#fff',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
              }}>
                确认拒绝
              </button>
              <button onClick={() => setShowRejectForm(false)} style={{
                padding: '8px 20px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer',
              }}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={handleApprove} disabled={actionLoading} style={{
              padding: '10px 32px', background: '#27ae60', color: '#fff',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '15px',
            }}>
              批准
            </button>
            <button onClick={() => setShowRejectForm(true)} disabled={actionLoading} style={{
              padding: '10px 32px', background: '#e74c3c', color: '#fff',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '15px',
            }}>
              拒绝
            </button>
          </>
        )}
      </div>
    </div>
  );
}
