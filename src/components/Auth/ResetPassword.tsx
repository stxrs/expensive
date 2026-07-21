import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import pb from '../../api/pocketbase';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await pb.collection('users').requestPasswordReset(email);
      setMsg('Password reset e‑mail sent. Check your inbox.');
    } catch (err: any) {
      setMsg(err?.response?.data?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth">
      <h2>Reset password</h2>
      <form onSubmit={handle}>
        <input type="email" placeholder="Your e‑mail" required value={email} onChange={e=>setEmail(e.target.value)} />
        <button type="submit" disabled={loading}>Send reset link</button>
      </form>
      {msg && <p>{msg}</p>}
      <p><Link to="/login">Back to login</Link></p>
    </section>
  );
}
