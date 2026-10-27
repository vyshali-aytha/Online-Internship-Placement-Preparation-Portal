import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RecruiterRequestPage from './RecruiterRequestPage';
import './styles.css';

// Minimal path-based routing (no router dependency in the project).
const isRecruiterRequest = window.location.pathname.replace(/\/+$/, '') === '/recruiter-request';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isRecruiterRequest ? <RecruiterRequestPage /> : <App />}
  </React.StrictMode>,
);