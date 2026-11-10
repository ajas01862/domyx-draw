import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CalendarDays, Dices, Gift, Plus, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';
import type { DrawRecord, EventRecord } from '../types';

export function Dashboard() {
  const { user, profile } = useAuth(); const [events, setEvents] = useState<EventRecord[]>([]); const [draws, setDraws] = useState<DrawRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase || !user) { setLoading(false); return; }
    let active = true;
    Promise.all([supabase.from('events').select('id,title,slug,description,status,visibility,starts_at,created_at').order('created_at', { ascending: false }).limit(5), supabase.from('draws').select('id,title,draw_type,status,participant_count,winner_count,created_at').order('created_at', { ascending: false }).limit(5)]).then(([eventResult, drawResult]) => {
      if (!active) return;
      if (eventResult.error || drawResult.error) setError(eventResult.error?.message || drawResult.error?.message || 'Could not load dashboard data.');
      setEvents((eventResult.data || []) as EventRecord[]); setDraws((drawResult.data || []) as DrawRecord[]); setLoading(false);
    });
    return () => { active = false; };
  }, [user]);
  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">YOUR WORKSPACE</span><h1>Good to see you, {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'} <span className="wave">✦</span></h1><p>Here's what's happening with your events and draws.</p></div><Link to="/dashboard/draws" className="button button-primary"><Plus size={17} /> Create a draw</Link></div>{error && <div className="alert alert-error">{error}</div>}
    <div className="stats-grid"><Stat icon={<Gift />} label="Total draws" value={String(draws.length)} note="Recent draws in your workspace" tone="purple" /><Stat icon={<CalendarDays />} label="Events" value={String(events.length)} note="Events you've created" tone="blue" /><Stat icon={<Users />} label="Participants" value={String(draws.reduce((sum, draw) => sum + draw.participant_count, 0))} note="Across recent draws" tone="pink" /><Stat icon={<Activity />} label="Live rooms" value="—" note="Realtime rooms planned" tone="green" /></div>
    <section className="welcome-banner"><div className="welcome-decoration"><Sparkles size={96} /></div><div className="welcome-content"><span className="banner-eyebrow">LET'S MAKE IT HAPPEN</span><h2>Your next big moment<br />starts with a draw.</h2><p>Pick a winner, launch an event or bring your community together.</p><Link to="/dashboard/draws" className="button button-white">Start a random draw <ArrowRight size={16} /></Link></div><div className="banner-side"><div className="banner-stat"><Trophy size={20} /><strong>Fair by design</strong><span>Server-side selection</span></div><div className="banner-stat"><Zap size={20} /><strong>Built to go live</strong><span>Realtime features planned</span></div></div></section>
    <div className="dashboard-columns"><ActivityPanel title="Recent draws" subtitle="Your latest winner selections" to="/dashboard/history">{loading ? <Loading /> : draws.length ? draws.map((draw) => <ActivityRow key={draw.id} icon={<Dices />} title={draw.title} subtitle={`${draw.participant_count} participants · ${formatDate(draw.created_at)}`} status={draw.status} />) : <Empty title="No draws yet" text="Create your first draw and see it here." to="/dashboard/draws" />}</ActivityPanel><ActivityPanel title="Your events" subtitle="Events you're organizing" to="/dashboard/events">{loading ? <Loading /> : events.length ? events.map((event) => <ActivityRow key={event.id} icon={<CalendarDays />} title={event.title} subtitle={`${event.visibility} · ${formatDate(event.starts_at || event.created_at)}`} status={event.status} />) : <Empty title="No events created" text="Create an event and invite people to join." to="/dashboard/events" />}</ActivityPanel></div>
    <section className="quick-actions"><div className="panel-heading"><div><h2>Quick actions</h2><p>Jump straight into what you need</p></div></div><div className="quick-grid"><QuickAction icon={<Dices />} title="Random picker" text="Select a winner" to="/dashboard/draws" /><QuickAction icon={<CalendarDays />} title="Create event" text="Bring people together" to="/dashboard/events" /><QuickAction icon={<Users />} title="Chitty manager" text="Manage your group" to="/dashboard/chitty" /><QuickAction icon={<Activity />} title="Live rooms" text="Host a live selection" to="/dashboard/rooms" /></div></section>
  </div>;
}
function Stat({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone: string }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></div>; }
function Loading() { return <div className="empty-state"><span className="spinner" /> Loading activity…</div>; }
function ActivityPanel({ title, subtitle, to, children }: { title: string; subtitle: string; to: string; children: ReactNode }) { return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><Link to={to}>View all <ArrowRight size={14} /></Link></div><div className="activity-list">{children}</div></section>; }
function ActivityRow({ icon, title, subtitle, status }: { icon: ReactNode; title: string; subtitle: string; status: string }) { return <div className="activity-row"><span className="activity-icon purple">{icon}</span><div className="activity-info"><strong>{title}</strong><span>{subtitle}</span></div><span className={`status-pill status-${status}`}>{status}</span></div>; }
function Empty({ title, text, to }: { title: string; text: string; to: string }) { return <div className="empty-state"><strong>{title}</strong><p>{text}</p><Link className="button button-secondary button-small" to={to}>Get started <ArrowRight size={14} /></Link></div>; }
function QuickAction({ icon, title, text, to }: { icon: ReactNode; title: string; text: string; to: string }) { return <Link to={to} className="quick-action"><span>{icon}</span><div><strong>{title}</strong><small>{text}</small></div><ArrowRight size={16} /></Link>; }
