import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';

export function Dashboard({ token }: { token: string }) {
  const [me, setMe] = useState<any>();
  const [address, setAddress] = useState<string>('');
  const { t } = useI18n();

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
        <h2>{t('dashboard.balance')}</h2>
        <div className="kpi">{me ? (me.balanceCents/100).toFixed(2) : '0.00'} {t('generic.usdt')}</div>
        <div className="badge" style={{ marginTop: 8 }}>{me?.email}</div>
      </div>
      <div className="card">
        <h2>{t('dashboard.depositTitle')}</h2>
        <div className="row"><span className="label">{t('dashboard.address')}</span><span>{address || '—'}</span></div>
        <div style={{ marginTop: 8 }}><small>{t('dashboard.note')}</small></div>
      </div>
      <div className="card">
        <h2>{t('dashboard.play')}</h2>
        <a className="btn" href="#/games">{t('dashboard.openLobby')}</a>
      </div>
    </div>
  );
}