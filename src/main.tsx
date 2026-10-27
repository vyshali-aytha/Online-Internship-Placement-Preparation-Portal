import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RecruiterRequestPage from './RecruiterRequestPage';
import AdminLoginPage from './AdminLoginPage';
import AdminDashboardPage from './AdminDashboardPage';
import './styles.css';

// Minimal path-based routing (no router dependency in the project).
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {currentPath === '/recruiter-request' ? <RecruiterRequestPage />
      : currentPath === '/admin/login' ? <AdminLoginPage />
        : currentPath === '/admin' ? <AdminDashboardPage />
          : <App />}
  </React.StrictMode>,
);