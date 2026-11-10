import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Brand } from '../components/Brand';
import { formatDate } from '../lib/utils';

type PublicEventRecord = { id: string; title: string; description: string | null; starts_at: string | null; status: string; visibility: string };
export function PublicEvent() {
  const { slug } = useParams(); const [event, setEvent] = useState<PublicEventRecord | null>(null); const [loaded, setLoaded] = useState(false); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (supabase && slug) supabase.from('events').select('id,title,description,starts_at,status,visibility').eq('slug', slug).maybeSingle().then(({ data }) => { setEvent(data as PublicEventRecord | null); setLoaded(true); }); }, [slug]);
  const register = async (formEvent: FormEvent<HTMLFormElement>) => { formEvent.preventDefault(); if (!supabase || !event) return; setBusy(true); setMessage(''); const { error } = await supabase.functions.invoke('register-event', { body: { event_id: event.id, display_name: name, email } }); setMessage(error ? error.message : 'Registration received. You are on the list!'); if (!error) { setName(''); setEmail(''); } setBusy(false); };
  return <div className="public-page"><header><Brand /></header>{!loaded ? <div className="public-card">Loading event…</div> : !event ? <div className="public-card"><h1>Event not found</h1><p>This event may be private, unavailable or no longer exist.</p></div> : <div className="public-card"><span className="section-kicker">YOU'RE INVITED</span><h1>{event.title}</h1><p>{event.description || 'Join this event and be part of the moment.'}</p><div className="public-meta"><span><CalendarDays size={16} /> {formatDate(event.starts_at)}</span><span><Users size={16} /> Registration open</span></div><form className="form-stack" onSubmit={register}><label>Your name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></label><label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><button className="button button-primary button-full" disabled={busy}>{busy ? 'Submitting…' : 'Register for event'} <CheckCircle2 size={17} /></button></form>{message && <div className="alert alert-info">{message}</div>}</div>}</div>;
}
