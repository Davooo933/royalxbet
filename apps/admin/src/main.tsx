import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './pages/AdminApp';

const root = document.getElementById('root')!;
createRoot(root).render(<AdminApp />);