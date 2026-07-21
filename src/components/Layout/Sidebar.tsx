import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaMoneyBillAlt, FaChartPie, FaListAlt, FaCog } from 'react-icons/fa';

export default function Sidebar() {
  const link = (to: string, icon: JSX.Element, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? 'active' : '')}
      style={{ display: 'flex', alignItems: 'center', marginBottom: '0.6rem' }}
    >
      {icon}
      <span style={{ marginLeft: '0.5rem' }}>{label}</span>
    </NavLink>
  );

  return (
    <aside className="sidebar">
      {link('/', <FaHome />, 'Dashboard')}
      {link('/transactions', <FaMoneyBillAlt />, 'Transactions')}
      {link('/categories', <FaListAlt />, 'Categories')}
      {link('/budgets', <FaChartPie />, 'Budgets')}
      {link('/settings', <FaCog />, 'Settings')}
    </aside>
  );
}
