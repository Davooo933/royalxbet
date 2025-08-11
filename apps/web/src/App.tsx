import React, { useEffect, useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { GamesHub } from './pages/GamesHub';
import './styles.css';

export function App() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function logout() { localStorage.removeItem('token'); setToken(''); window.location.hash = '/login'; }

  return (
    <div className="app-root">
      <nav className="navbar">
        <div className="brand">RoyalX Casino</div>
        <div className="nav-links">
          {!token ? (
            <>
              <a href="#/login">Login</a>
              <a href="#/register">Register</a>
            </>
          ) : (
            <>
              <a href="#/">Dashboard</a>
              <a href="#/games">Games</a>
              <button className="btn" onClick={logout}>Logout</button>
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