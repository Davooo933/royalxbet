import React, { useState } from 'react';
import { api } from '../lib/api';

export function Login({ onAuthed }: { onAuthed: (token: string)=>void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try {
      const { data } = await api().post('/auth/login', { email, password });
      onAuthed(data.token);
    } catch (e: any) { setError(e?.response?.data?.error || 'Login failed'); }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '60px auto' }}>
      <h2>Login</h2>
      <form onSubmit={submit}>
        <label className="label">Email</label>
        <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
        <label className="label" style={{ marginTop: 12 }}>Password</label>
        <input className="input" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••" />
        {error && <div style={{ color: '#ff5b5b', marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 16 }}>
          <button className="btn" type="submit">Sign in</button>
          <a href="#/register" style={{ marginLeft: 12 }}>Create account</a>
        </div>
      </form>
    </div>
  );
}