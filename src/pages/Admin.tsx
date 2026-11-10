import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { CalendarDays, Dices, RefreshCw, Shield, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Admin() {
  const [stats, setStats] = useState({ users: 0, events: 0, draws: 0 }); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = async () => { if (!supabase) return; const [users, events, draws] = await Promise.all([supabase.from('profiles').select('*', { count: 'exact', head: true }), supabase.from('events').select('*', { count: 'exact', head: true }), supabase.from('draws').select('*', { count: 'exact', head: true })]); const firstError = users.error || events.error || draws.error; if (firstError) setError(firstError.message); else setStats({ users: users.count || 0, events: events.count || 0, draws: draws.count || 0 }); setLoading(false); };
  useEffect(() => { void load(); }, []);
  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">RESTRICTED AREA</span><h1>Platform administration</h1><p>Platform overview. Access is controlled by the database administrator role.</p></div><span className="admin-badge"><Shield size={15} /> ADMIN</span></div>{error && <div className="alert alert-error">{error}</div>}<div className="stats-grid"><AdminStat icon={<Users />} label="Accounts" value={stats.users} /><AdminStat icon={<CalendarDays />} label="Events" value={stats.events} /><AdminStat icon={<Dices />} label="Draws" value={stats.draws} /></div><div className="panel"><div className="panel-heading"><div><h2>System overview</h2><p>Live counts from Supabase</p></div><button className="icon-button" onClick={() => { setLoading(true); void load(); }} aria-label="Refresh"><RefreshCw size={17} /></button></div>{loading ? 'Loading…' : <p className="muted-copy">The admin overview is connected. User management, moderation queues, billing operations and audit search need further implementation before public launch.</p>}</div></div>;
}
function AdminStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <div className="stat-card"><div className="stat-icon purple">{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></div>; }
