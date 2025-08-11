import React, { useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';

export function Register({ onAuthed }: { onAuthed: (token: string)=>void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { t } = useI18n();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try {
      const { data } = await api().post('/auth/register', { email, password });
      onAuthed(data.token);
    } catch (e: any) { setError(e?.response?.data?.error || 'Registration failed'); }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '60px auto' }}>
      <h2>{t('register.title')}</h2>
      <form onSubmit={submit}>
        <label className="label">{t('register.email')}</label>
        <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
        <label className="label" style={{ marginTop: 12 }}>{t('register.password')}</label>
        <input className="input" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="8+ characters" />
        {error && <div style={{ color: '#ff5b5b', marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 16 }}>
          <button className="btn" type="submit">{t('register.submit')}</button>
          <a href="#/login" style={{ marginLeft: 12 }}>{t('register.toLogin')}</a>
        </div>
      </form>
    </div>
  );
}