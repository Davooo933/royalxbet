import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function Dashboard({ token }: { token: string }) {
  const [me, setMe] = useState<any>();
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data } = await api(token).get('/auth/me');
      setMe(data);
      const dep = await api(token).get('/wallet/deposit-address');
      setAddress(dep.data.address);
    })();
  }, [token]);

  return (
    <div className="grid">
      <div className="card">
        <h2>Balance</h2>
        <div className="kpi">{me ? (me.balanceCents/100).toFixed(2) : '0.00'} USDT</div>
        <div className="badge" style={{ marginTop: 8 }}>{me?.email}</div>
      </div>
      <div className="card">
        <h2>Deposit (USDT TRC-20)</h2>
        <div className="row"><span className="label">Address</span><span>{address || '—'}</span></div>
        <div style={{ marginTop: 8 }}><small>Send only USDT on TRON (TRC-20). Credits occur after network confirmation.</small></div>
      </div>
      <div className="card">
        <h2>Play</h2>
        <a className="btn" href="#/games">Open Games Lobby</a>
      </div>
    </div>
  );
}