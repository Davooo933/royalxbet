import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function AdminApp() {
  const [token, setToken] = useState('');
  const [stats, setStats] = useState<any>();
  const [bonusEmail, setBonusEmail] = useState('');
  const [bonusAmount, setBonusAmount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // For demo: read token from localStorage
    const t = localStorage.getItem('adminToken') || '';
    setToken(t);
  }, []);

  async function refreshStats() {
    const { data } = await axios.get(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
    setStats(data);
  }

  async function sendBonus() {
    await axios.post(`${API}/admin/bonus`, { email: bonusEmail, amountCents: Math.round(bonusAmount * 100) }, { headers: { Authorization: `Bearer ${token}` } });
    setMessage('Bonus sent');
    setBonusAmount(0);
    setBonusEmail('');
    await refreshStats();
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Casino Admin</h1>
      <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd' }}>
        <h2>Auth</h2>
        <input style={{ width: '60%' }} placeholder="Paste admin JWT here" value={token} onChange={e => { setToken(e.target.value); localStorage.setItem('adminToken', e.target.value); }} />
        <button onClick={refreshStats} style={{ marginLeft: 8 }}>Load Stats</button>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1, padding: 12, border: '1px solid #ddd' }}>
          <h2>Stats</h2>
          {stats ? (
            <ul>
              <li>Users: {stats.users}</li>
              <li>Bets: {stats.bets}</li>
              <li>Transactions: {stats.transactions}</li>
              <li>Gross Wager: ${(stats.grossWager/100).toFixed(2)} USDT</li>
              <li>Gross Payout: ${(stats.grossPayout/100).toFixed(2)} USDT</li>
              <li>Profit: ${(stats.profit/100).toFixed(2)} USDT</li>
            </ul>
          ) : <div>No data</div>}
        </div>

        <div style={{ flex: 1, padding: 12, border: '1px solid #ddd' }}>
          <h2>Send Bonus</h2>
          <input placeholder="User email" value={bonusEmail} onChange={e=>setBonusEmail(e.target.value)} />
          <input placeholder="Amount (USDT)" type="number" value={bonusAmount} onChange={e=>setBonusAmount(Number(e.target.value))} />
          <button onClick={sendBonus}>Send</button>
          <div>{message}</div>
        </div>
      </div>
    </div>
  );
}