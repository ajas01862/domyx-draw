import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock3, Radio, Sparkles, Trophy, Users } from 'lucide-react';
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
    const timer = window.setInterval(() => void refresh(), 250);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const running = state?.status === 'running';
  const completed = state?.status === 'completed';
  const confetti = Array.from({ length: 42 }, (_, index) => ({ id: index, left: `${(index * 37) % 100}%`, delay: `${(index % 9) * 0.08}s`, duration: `${2.2 + (index % 5) * 0.35}s`, drift: `${((index * 19) % 180) - 90}px`, rotation: `${(index * 47) % 720}deg` }));

  return <main className="chitty-live-page">
    <div className="chitty-live-top"><span className="live-brand">DOMYX <b>DRAW</b></span><span className="live-indicator"><i /> LIVE BROADCAST</span></div>
    {error ? <section className="chitty-live-stage"><h1>Live draw unavailable</h1><p>{error}</p></section> : !state ? <section className="chitty-live-stage"><div className="live-pulse" /><p>Connecting to live draw…</p></section> : <>
      <section className="chitty-live-heading"><span className="section-kicker">MONTHLY CHITTY · ROUND {state.round_number}</span><h1>{state.group_name}</h1><p>Transparent selection · Live audience view</p></section>
      <section className={`chitty-live-stage ${completed ? 'is-complete' : ''}`}>
        <div className="live-stage-meta"><span><Users size={15} /> {state.participants.length} eligible members</span><span><Radio size={15} /> {state.status.toUpperCase()}</span></div>
        {completed ? <div className="live-celebration"><div className="live-confetti" aria-hidden="true">{confetti.map((piece) => <motion.i key={piece.id} style={{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration, ['--confetti-drift' as string]: piece.drift, ['--confetti-rotation' as string]: piece.rotation }} />)}</div><motion.div className="live-winner-icon" initial={{ scale: 0, rotate: -35 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}><Trophy size={38} /></motion.div><motion.span className="section-kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }}>THE MONTHLY WINNER</motion.span><motion.h2 key={state.winner_name} initial={{ opacity: 0, y: 28, scale: .72, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} transition={{ delay: .2, type: 'spring', stiffness: 150, damping: 13 }}>{state.winner_name}</motion.h2><motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .45 }}>Congratulations! This month's payout belongs to you.</motion.p><motion.div className="live-congrats" initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .55, type: 'spring' }}><Sparkles size={18} /> CONGRATULATIONS <Sparkles size={18} /></motion.div><div className="live-complete-note"><CheckCircle2 size={17} /> Draw completed and recorded</div></div> : running ? <><span className="section-kicker">SELECTING FROM ELIGIBLE MEMBERS</span><motion.div key={`${state.current_index}-${state.current_name}`} className="live-name-reveal" initial={{ opacity: 0, y: 12, scale: .96, filter: 'blur(5px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .12, ease: 'easeOut' }}><span>{state.current_name || 'Preparing selection…'}</span></motion.div><div className="live-progress"><i style={{ width: `${Math.max(0, Math.min(100, ((state.current_index + 1) / Math.max(state.participants.length, 1)) * 100))}%` }} /></div><p className="live-stage-caption">Member {Math.max(0, state.current_index + 1)} of {state.participants.length}</p></> : <><div className="live-wait-icon"><Clock3 size={32} /></div><h2>{state.status === 'ready' ? 'Draw is ready' : 'Your host is preparing the draw'}</h2><p>{state.status === 'ready' ? 'The selection will begin shortly.' : 'Stay on this page. The live selection will appear here.'}</p></>}
      </section>
      <section className="live-audience-list"><div><span className="section-kicker">ELIGIBLE MEMBERS</span><strong>{state.participants.length} participants</strong></div><div className="live-member-grid">{state.participants.map((member, index) => <span key={member.id} className={index <= state.current_index && running ? 'member-seen' : ''}>{member.name}</span>)}</div></section>
    </>}
    <footer className="chitty-live-footer">Powered by <strong>Domyx Draw</strong> · Fair, transparent and recorded.</footer>
  </main>;
}
