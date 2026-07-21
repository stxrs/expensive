import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { pb } from './api/pocketbase';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ResetPassword from './components/Auth/ResetPassword';
import Dashboard from './components/Dashboard/Overview';
import Transactions from './components/Transactions/List';
import Categories from './components/Categories/Manage';
import Budgets from './components/Budgets/Manage';
import Settings from './components/Settings/SettingsPage';
import './App.css';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const isAuth = !!pb.authStore.isValid;
  const location = useLocation();
  return isAuth ? children : <Navigate to="/login" state={{ from: location }} replace />;
};

export default function App() {
  // Apply saved theme on first load
  useEffect(() => {
    const saved = localStorage.getItem('theme') ?? 'light';
    document.documentElement.dataset.theme = saved;
  }, []);

  return (
    <div className="app">
      <Header />
      <div className="main">
        <Sidebar />
        <div className="content">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/transactions/*" element={<PrivateRoute><Transactions /></PrivateRoute>} />
            <Route path="/categories/*" element={<PrivateRoute><Categories /></PrivateRoute>} />
            <Route path="/budgets/*" element={<PrivateRoute><Budgets /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
