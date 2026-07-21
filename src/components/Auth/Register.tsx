import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import pb from '../../api/pocketbase';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    setError(null);
    try {
      await pb.collection('users').create({ email, password, passwordConfirm: confirm });
      // Auto‑login after registration
      await pb.collection('users').authWithPassword(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" required value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)} />
        <input type="password" placeholder="Confirm password" required value={confirm} onChange={e=>setConfirm(e.target.value)} />
        <button type="submit" disabled={loading}>Register</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      <p>Already have an account? <Link to="/login">Login</Link></p>
    </section>
  );
}
