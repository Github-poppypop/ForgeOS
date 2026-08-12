import ReactDOM from 'react-dom/client';
import App, { DebugErrorBoundary } from './App';
import './styles/design.css';

const el = document.getElementById('app');
if (!el) throw new Error('missing #app');
ReactDOM.createRoot(el).render(
  <DebugErrorBoundary>
    <App />
  </DebugErrorBoundary>
);
