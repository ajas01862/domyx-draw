import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock3, Radio, Trophy, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

type LiveState = { group_name: string; round_number: number; status: string; participants: { id: string; name: string }[]; current_index: number; current_name: string | null; winner_name: string | null; updated_at: string };

export function ChittyLive() {
  const { token = '' } = useParams();
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase || !/^[0-9a-f-]{36}$/i.test(token)) return;
    const { data, error: queryError } = await supabase.rpc('get_chitty_live_session', { p_token: token });
    if (queryError) setError(queryError.message);
    else if (!data) setError('This live draw link is invalid or no longer available.');
    else { setState(data as LiveState); setError(''); }
  }, [token]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const running = state?.status === 'running';
  const completed = state?.status === 'completed';

  return <main className="chitty-live-page">
    <div className="chitty-live-top"><span className="live-brand">DOMYX <b>DRAW</b></span><span className="live-indicator"><i /> LIVE BROADCAST</span></div>
    {error ? <section className="chitty-live-stage"><h1>Live draw unavailable</h1><p>{error}</p></section> : !state ? <section className="chitty-live-stage"><div className="live-pulse" /><p>Connecting to live draw…</p></section> : <>
      <section className="chitty-live-heading"><span className="section-kicker">MONTHLY CHITTY · ROUND {state.round_number}</span><h1>{state.group_name}</h1><p>Transparent selection · Live audience view</p></section>
      <section className={`chitty-live-stage ${completed ? 'is-complete' : ''}`}>
        <div className="live-stage-meta"><span><Users size={15} /> {state.participants.length} eligible members</span><span><Radio size={15} /> {state.status.toUpperCase()}</span></div>
        {completed ? <><div className="live-winner-icon"><Trophy size={34} /></div><span className="section-kicker">THE MONTHLY WINNER</span><motion.h2 key={state.winner_name} initial={{ opacity: 0, y: 18, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }}>{state.winner_name}</motion.h2><p>Congratulations. The result has been recorded.</p><div className="live-complete-note"><CheckCircle2 size={17} /> Draw completed</div></> : running ? <><span className="section-kicker">SELECTING FROM ELIGIBLE MEMBERS</span><motion.div key={`${state.current_index}-${state.current_name}`} className="live-name-reveal" initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: .32 }}><span>{state.current_name || 'Preparing selection…'}</span></motion.div><div className="live-progress"><i style={{ width: `${Math.max(0, Math.min(100, ((state.current_index + 1) / Math.max(state.participants.length, 1)) * 100))}%` }} /></div><p className="live-stage-caption">Member {Math.max(0, state.current_index + 1)} of {state.participants.length}</p></> : <><div className="live-wait-icon"><Clock3 size={32} /></div><h2>{state.status === 'ready' ? 'Draw is ready' : 'Your host is preparing the draw'}</h2><p>{state.status === 'ready' ? 'The selection will begin shortly.' : 'Stay on this page. The live selection will appear here.'}</p></>}
      </section>
      <section className="live-audience-list"><div><span className="section-kicker">ELIGIBLE MEMBERS</span><strong>{state.participants.length} participants</strong></div><div className="live-member-grid">{state.participants.map((member, index) => <span key={member.id} className={index <= state.current_index && running ? 'member-seen' : ''}>{member.name}</span>)}</div></section>
    </>}
    <footer className="chitty-live-footer">Powered by <strong>Domyx Draw</strong> · Fair, transparent and recorded.</footer>
  </main>;
}
