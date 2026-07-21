import React from 'react';
import pb from '../../api/pocketbase';
import { useNavigate } from 'react-router-dom';
import { FaMoon, FaSun } from 'react-icons/fa';

export default function Header() {
  const navigate = useNavigate();

  const logout = async () => {
    await pb.authStore.clear();
    navigate('/login');
  };

  const toggleTheme = () => {
    const newTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = newTheme;
    localStorage.setItem('theme', newTheme);
  };

  return (
    <header className="header">
      <h1>Expensive</h1>
      <div>
        <button onClick={toggleTheme} style={{ marginRight: '0.5rem' }}>
          {document.documentElement.dataset.theme === 'dark' ? <FaSun /> : <FaMoon />}
        </button>
        {pb.authStore.isValid && (<button onClick={logout}>Logout</button>)}
      </div>
    </header>
  );
}
