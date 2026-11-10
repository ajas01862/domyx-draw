import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { CalendarDays, Copy, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/Modal';
import { formatDate, slugify } from '../lib/utils';
import type { EventRecord } from '../types';

export function Events() {
  const { user } = useAuth(); const [events, setEvents] = useState<EventRecord[]>([]); const [loading, setLoading] = useState(true); const [showModal, setShowModal] = useState(false); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [visibility, setVisibility] = useState('public'); const [startsAt, setStartsAt] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => { if (!supabase) { setLoading(false); return; } const { data, error: loadError } = await supabase.from('events').select('id,title,slug,description,status,visibility,starts_at,created_at').order('created_at', { ascending: false }); if (loadError) setError(loadError.message); else setEvents((data || []) as EventRecord[]); setLoading(false); };
  useEffect(() => { void load(); }, [user]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    if (!supabase || !user) { setError('Sign in to create an event.'); setBusy(false); return; }
    try {
      const { data: workspace, error: workspaceError } = await supabase.from('workspaces').select('id').limit(1).maybeSingle();
      if (workspaceError) throw workspaceError;
      if (!workspace) throw new Error('Workspace not found. Check the migration and sign in again.');
      const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 6)}`;
      const { error: insertError } = await supabase.from('events').insert({ workspace_id: workspace.id, created_by: user.id, title, description, slug, visibility, status: 'published', starts_at: startsAt ? new Date(startsAt).toISOString() : null });
      if (insertError) throw insertError;
      setShowModal(false); setTitle(''); setDescription(''); setStartsAt(''); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create event.'); } finally { setBusy(false); }
  };
  const copyLink = async (slug: string) => { const url = `${window.location.origin}${window.location.pathname}#/event/${slug}`; try { await navigator.clipboard.writeText(url); setError('Event link copied to clipboard.'); } catch { setError(url); } };
  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">BRING PEOPLE TOGETHER</span><h1>Events</h1><p>Create public or private events and share registration links.</p></div><button className="button button-primary" onClick={() => { setError(''); setShowModal(true); }}><Plus size={17} /> Create event</button></div>{error && <div className="alert alert-info">{error}</div>}<div className="panel table-panel"><div className="panel-heading"><div><h2>Your events</h2><p>{events.length} events in your workspace</p></div><button className="icon-button" onClick={() => { setLoading(true); void load(); }} aria-label="Refresh"><RefreshCw size={17} /></button></div>{loading ? <div className="empty-state"><span className="spinner" /> Loading events…</div> : events.length ? <div className="table-wrap"><table><thead><tr><th>EVENT</th><th>VISIBILITY</th><th>STATUS</th><th>DATE</th><th>SHARE</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><strong>{event.title}</strong><small className="table-sub">{event.slug}</small></td><td>{event.visibility}</td><td><span className={`status-pill status-${event.status}`}>{event.status}</span></td><td>{formatDate(event.starts_at || event.created_at)}</td><td><button className="table-action" onClick={() => void copyLink(event.slug)}><Copy size={14} /> Copy link</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="empty-icon"><CalendarDays /></span><strong>No events yet</strong><p>Create an event, publish it and invite your community.</p><button className="button button-primary button-small" onClick={() => setShowModal(true)}>Create your first event <Plus size={15} /></button></div>}</div>{showModal && <Modal title="Create an event" onClose={() => setShowModal(false)}><form className="form-stack modal-form" onSubmit={create}><label>Event name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Community giveaway" required maxLength={120} /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell people what this event is about…" rows={4} /></label><label>Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="public">Public — discoverable</option><option value="unlisted">Unlisted — link only</option><option value="private">Private — restricted</option></select></label><label>Start date (optional)<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><button className="button button-primary button-full" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button></form></Modal>}</div>;
}
