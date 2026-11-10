import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, ChartNoAxesCombined, CircleHelp, Crown, Gift, History, LayoutDashboard, LogOut, Menu, Settings, Shield, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Brand } from './Brand';
import { initials } from '../lib/utils';

const links = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/draws', label: 'Draws', icon: Gift },
  { to: '/dashboard/events', label: 'Events', icon: CalendarDays },
  { to: '/dashboard/chitty', label: 'Chitty manager', icon: Users },
  { to: '/dashboard/rooms', label: 'Live rooms', icon: Activity },
  { to: '/dashboard/history', label: 'History', icon: History },
  { to: '/dashboard/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const logout = async () => { await signOut(); navigate('/'); };
  return <div className="app-shell"><aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
    <div className="sidebar-head"><Brand /><button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
    <div className="workspace-switch"><span className="workspace-icon">D</span><span><strong>Personal workspace</strong><small>Free plan</small></span><span className="chevron">⌄</span></div>
    <p className="nav-caption">WORKSPACE</p><nav className="side-nav">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
    <p className="nav-caption">ACCOUNT</p><nav className="side-nav"><NavLink to="/dashboard/billing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Crown size={18} /><span>Upgrade plan</span></NavLink><NavLink to="/dashboard/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings size={18} /><span>Settings</span></NavLink>{profile?.is_admin && <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Shield size={18} /><span>Administration</span></NavLink>}</nav>
    <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18} /><strong>Need a hand?</strong><span>Explore the getting started guide.</span><a href="https://github.com" target="_blank" rel="noreferrer">Help center ↗</a></div><div className="user-card"><span className="avatar">{initials(profile?.full_name || user?.email)}</span><span className="user-meta"><strong>{profile?.full_name || user?.email?.split('@')[0] || 'Account'}</strong><small>{user?.email}</small></span><button className="icon-button" onClick={logout} title="Sign out"><LogOut size={17} /></button></div></div>
  </aside>{open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}<main className="main-area"><header className="topbar"><button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumbs">Workspace <span>/</span> <strong>Dashboard</strong></div><div className="topbar-actions"><span className="status-dot" /><span className="online-label">All systems operational</span><button className="upgrade-button" onClick={() => navigate('/dashboard/billing')}><Crown size={15} /> Upgrade</button></div></header><div className="page-content"><Outlet /></div></main></div>;
}
