import { useEffect, useState } from 'react';
import { Activity, CalendarDays, Gift, RefreshCw, Trophy, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function Analytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ draws: 0, completed: 0, participants: 0, winners: 0, events: 0, rooms: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!supabase || !user) { setLoading(false); return; }
    setLoading(true); setError('');
    const [draws, completed, events, rooms] = await Promise.all([
      supabase.from('draws').select('id,participant_count,winner_count', { count: 'exact' }),
      supabase.from('draws').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('live_rooms').select('id', { count: 'exact', head: true }),
    ]);
    const firstError = draws.error || completed.error || events.error || rooms.error;
    if (firstError) setError(firstError.message);
    else setStats({ draws: draws.count || 0, completed: completed.count || 0, participants: (draws.data || []).reduce((sum, row) => sum + (row.participant_count || 0), 0), winners: (draws.data || []).reduce((sum, row) => sum + (row.winner_count || 0), 0), events: events.count || 0, rooms: rooms.count || 0 });
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user]);
  const cards = [{ label: 'Total draws', value: stats.draws, icon: Gift }, { label: 'Completed draws', value: stats.completed, icon: Trophy }, { label: 'Participants', value: stats.participants, icon: Users }, { label: 'Winner slots', value: stats.winners, icon: Activity }, { label: 'Events', value: stats.events, icon: CalendarDays }, { label: 'Live rooms', value: stats.rooms, icon: Activity }];

  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">PERFORMANCE</span><h1>Analytics</h1><p>Workspace activity totals calculated from your saved records.</p></div><button className="button button-secondary" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button></div>{error && <div className="alert alert-error">{error}</div>}<div className="stats-grid">{cards.map(({ label, value, icon: Icon }) => <div className="stat-card" key={label}><div className="stat-icon purple"><Icon /></div><span className="stat-label">{label}</span><strong className="stat-value">{loading ? '—' : value.toLocaleString()}</strong><span className="stat-note">All accessible workspace records</span></div>)}</div><section className="panel"><div className="panel-heading"><div><h2>Draw completion</h2><p>Completed versus all recorded draws</p></div></div><div className="activity-list"><div className="activity-row"><div className="activity-info"><strong>Completion rate</strong><span>{stats.draws ? `${Math.round((stats.completed / stats.draws) * 100)}% of recorded draws` : 'No draws recorded yet'}</span></div><strong>{stats.draws ? `${stats.completed}/${stats.draws}` : '0/0'}</strong></div><div className="progress-track"><span style={{ width: `${stats.draws ? (stats.completed / stats.draws) * 100 : 0}%` }} /></div></div></section></div>;
}
