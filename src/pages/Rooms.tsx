import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Activity, Copy, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentWorkspaceId } from '../lib/workspace';

type Room = { id: string; room_code: string; title: string; visibility: string; status: string; created_at: string };

export function Rooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const { data, error: queryError } = await supabase.from('live_rooms').select('id,room_code,title,visibility,status,created_at').order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setRooms((data || []) as Room[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !user) return;
    setBusy(true); setError('');
    try {
      const workspaceId = await getCurrentWorkspaceId(user.id);
      const roomCode = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
      const { error: insertError } = await supabase.from('live_rooms').insert({ workspace_id: workspaceId, created_by: user.id, room_code: roomCode, title: title.trim(), visibility, status: 'waiting' });
      if (insertError) throw insertError;
      setTitle(''); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create room.'); }
    finally { setBusy(false); }
  };

  const updateStatus = async (room: Room, status: string) => {
    if (!supabase) return;
    const { error: updateError } = await supabase.from('live_rooms').update({ status }).eq('id', room.id);
    if (updateError) setError(updateError.message);
    else await load();
  };

  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">COMMUNITY</span><h1>Live rooms</h1><p>Create shareable rooms and manage their waiting, live and ended states.</p></div><button className="button button-secondary" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button></div>{error && <div className="alert alert-error">{error}</div>}<section className="panel"><div className="panel-heading"><div><h2>Create a room</h2><p>Invite your audience with a unique room code.</p></div><Activity size={20} /></div><form className="inline-form" onSubmit={create}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Room title" maxLength={120} required /><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select><button className="button button-primary" disabled={busy}><Plus size={16} /> {busy ? 'Creating…' : 'Create room'}</button></form></section><section className="panel"><div className="panel-heading"><div><h2>Your rooms</h2><p>Room links and status controls</p></div></div>{loading ? <div className="empty-state">Loading rooms…</div> : rooms.length ? <div className="activity-list">{rooms.map((room) => <div className="activity-row" key={room.id}><div className="activity-icon purple"><Activity size={18} /></div><div className="activity-info"><strong>{room.title}</strong><span>Code: {room.room_code} · {room.visibility}</span><span>Share this room code with participants: {room.room_code}</span></div><span className={`status-pill status-${room.status}`}>{room.status}</span><button className="icon-button" title="Copy room code" onClick={() => void navigator.clipboard.writeText(room.room_code)}><Copy size={16} /></button><select aria-label={`Status for ${room.title}`} value={room.status} onChange={(event) => void updateStatus(room, event.target.value)}><option value="waiting">Waiting</option><option value="live">Live</option><option value="ended">Ended</option></select></div>)}</div> : <div className="empty-state">No rooms created yet.</div>}</section></div>;
}
