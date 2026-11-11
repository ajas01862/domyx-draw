import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Landing } from '../pages/Landing';
import { Auth } from '../pages/Auth';
import { Dashboard } from '../pages/Dashboard';
import { Draws } from '../pages/Draws';
import { DrawHistory } from '../pages/DrawHistory';
import { Events } from '../pages/Events';
import { PublicEvent } from '../pages/PublicEvent';
import { Placeholder } from '../pages/Placeholder';
import { Admin } from '../pages/Admin';
import { AppShell } from '../components/AppShell';
import { AdminRoute, ProtectedRoute } from '../components/ProtectedRoute';

export function AppRouter() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><Routes><Route path="/" element={<Landing />} /><Route path="/login" element={<Auth mode="login" />} /><Route path="/register" element={<Auth mode="register" />} /><Route path="/event/:slug" element={<PublicEvent />} /><Route element={<ProtectedRoute />}><Route element={<AppShell />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/dashboard/draws" element={<Draws />} /><Route path="/dashboard/events" element={<Events />} /><Route path="/dashboard/chitty" element={<Placeholder type="chitty" />} /><Route path="/dashboard/rooms" element={<Placeholder type="rooms" />} /><Route path="/dashboard/history" element={<DrawHistory />} /><Route path="/dashboard/analytics" element={<Placeholder type="analytics" />} /><Route path="/dashboard/billing" element={<Placeholder type="billing" />} /><Route path="/dashboard/settings" element={<Placeholder type="settings" />} /></Route></Route><Route element={<AdminRoute />}><Route element={<AppShell />}><Route path="/admin" element={<Admin />} /></Route></Route><Route path="*" element={<Landing />} /></Routes></BrowserRouter>;
}
