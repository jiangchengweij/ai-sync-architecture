import { useState, FormEvent } from 'react';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#1a1a2e',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', padding: '40px', borderRadius: '8px',
        width: '360px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ margin: '0 0 24px', textAlign: 'center' }}>AI Project Sync</h2>
        {error && (
          <div style={{ color: '#e74c3c', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
        )}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>邮箱</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoFocus
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>密码</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '10px', background: '#3498db', color: '#fff',
          border: 'none', borderRadius: '4px', cursor: loading ? 'wait' : 'pointer',
          fontSize: '16px',
        }}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}
