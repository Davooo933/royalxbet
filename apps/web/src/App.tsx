import React, { useEffect, useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { GamesHub } from './pages/GamesHub';
import './styles.css';
import { I18nProvider, useI18n } from './i18n';

function AppInner() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const { t, setLocale, locale } = useI18n();

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function logout() { localStorage.removeItem('token'); setToken(''); window.location.hash = '/login'; }

  return (
    <div className="app-root">
      <nav className="navbar">
        <div className="brand">{t('app.brand')}</div>
        <div className="nav-links">
          <select className="input" style={{ maxWidth: 120 }} value={locale} onChange={(e)=>setLocale(e.target.value as any)}>
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>
          {!token ? (
            <>
              <a href="#/login">{t('nav.login')}</a>
              <a href="#/register">{t('nav.register')}</a>
            </>
          ) : (
            <>
              <a href="#/">{t('nav.dashboard')}</a>
              <a href="#/games">{t('nav.games')}</a>
              <button className="btn" onClick={logout}>{t('nav.logout')}</button>
            </>
          )}
        </div>
      </nav>
      <main className="container">
        {!token && route === '/register' && <Register onAuthed={(t)=>{localStorage.setItem('token', t); setToken(t); window.location.hash = '/';}} />}        
        {!token && (route === '/' || route === '/login') && <Login onAuthed={(t)=>{localStorage.setItem('token', t); setToken(t); window.location.hash = '/';}} />}
        {token && route === '/' && <Dashboard token={token} />}
        {token && route.startsWith('/games') && <GamesHub token={token} path={route} />}
      </main>
    </div>
  );
}

export function App(){
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}