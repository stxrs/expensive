import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import pb from '../../api/pocketbase';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await pb.collection('users').authWithPassword(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" required value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit" disabled={loading}>Login</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      <p>
        No account? <Link to="/register">Register</Link> • <Link to="/reset">Forgot password?</Link>
      </p>
    </section>
  );
}
