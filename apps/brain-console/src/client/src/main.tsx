import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/design.css';

const el = document.getElementById('app');
if (!el) throw new Error('missing #app');
ReactDOM.createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
