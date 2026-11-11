import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, History, RefreshCw, ShieldCheck, Trophy, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

type HistoryDraw = {
  id: string;
  title: string;
  draw_type: string;
  status: string;
  participant_count: number;
  winner_count: number;
  snapshot_hash: string | null;
  seed_commitment: string | null;
  seed_reveal: string | null;
  created_at: string;
  completed_at: string | null;
  draw_winners: { id: string; position: number; selected_at: string; draw_entries: { display_name: string; entry_key: string } | null }[];
};

export function DrawHistory() {
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verification, setVerification] = useState<Record<string, { checks: Record<string, boolean | number> }>>({});

  const load = useCallback(async () => {
    if (!supabase || !user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase.from('draws').select('id,title,draw_type,status,participant_count,winner_count,snapshot_hash,seed_commitment,seed_reveal,created_at,completed_at,draw_winners(id,position,selected_at,draw_entries(display_name,entry_key))').order('created_at', { ascending: false }).limit(100);
    if (queryError) setError(queryError.message);
    else setItems((data || []) as unknown as HistoryDraw[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const verifyDraw = async (drawId: string) => {
    if (!supabase) return;
    setVerifying(drawId);
    setError('');
    try {
      const { data, error: verifyError } = await supabase.functions.invoke('verify-draw', { body: { draw_id: drawId } });
      if (verifyError) {
        let message = verifyError.message;
        if ('context' in verifyError && verifyError.context instanceof Response) {
          try { message = (await verifyError.context.clone().json()).error || message; } catch { /* Keep the SDK message. */ }
        }
        throw new Error(message);
      }
      if (!data?.checks) throw new Error(data?.error || 'Verification did not return any checks.');
      setVerification((current) => ({ ...current, [drawId]: data }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not verify this draw.');
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-heading"><div><span className="section-kicker">YOUR ACTIVITY</span><h1>Draw history</h1><p>Review completed draws, selected winners and fairness records.</p></div><button className="button button-secondary" onClick={() => { setError(''); void load(); }}><RefreshCw size={16} /> Refresh</button></div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {loading ? <div className="panel empty-state"><span className="spinner" /> Loading history…</div> : items.length ? (
        <div className="history-list">{items.map((draw) => (
          <article className="panel history-card" key={draw.id}>
            <div className="history-card-head"><div><span className={`status-pill status-${draw.status}`}>{draw.status}</span><h2>{draw.title}</h2><p>{formatDate(draw.created_at)} · {draw.participant_count} participants · {draw.winner_count} winner{draw.winner_count === 1 ? '' : 's'}</p></div><span className="history-type">{draw.draw_type}</span></div>
            {draw.status === 'completed' ? <div className="history-winners"><div className="history-winners-title"><Trophy size={16} /> Selected winners</div>{draw.draw_winners?.length ? <ol>{[...draw.draw_winners].sort((a, b) => a.position - b.position).map((winner) => <li key={winner.id}><span>{winner.position}</span><strong>{winner.draw_entries?.display_name || 'Participant unavailable'}</strong></li>)}</ol> : <p>Winner records are not available.</p>}</div> : <p className="history-pending">No completed result recorded for this draw.</p>}
            <div className="history-actions">{draw.status === 'completed' && <button className="button button-secondary button-small" disabled={verifying === draw.id} onClick={() => void verifyDraw(draw.id)}>{verifying === draw.id ? 'Verifying…' : 'Verify fairness'} <ShieldCheck size={14} /></button>}</div>
            {verification[draw.id] && <div className="verification-result">{Object.entries(verification[draw.id].checks).map(([key, value]) => <div key={key} className="verification-check">{typeof value === 'boolean' ? value ? <CheckCircle2 size={15} /> : <XCircle size={15} /> : <span /> }<span>{key.replaceAll('_', ' ')}</span><strong>{typeof value === 'boolean' ? value ? 'Passed' : 'Failed' : value}</strong></div>)}</div>}
            <details className="history-verification"><summary><ShieldCheck size={15} /> Verification record</summary><dl><dt>Draw ID</dt><dd>{draw.id}</dd><dt>Seed commitment</dt><dd>{draw.seed_commitment || 'Unavailable'}</dd><dt>Revealed seed</dt><dd>{draw.seed_reveal || 'Not revealed'}</dd><dt>Snapshot hash</dt><dd>{draw.snapshot_hash || 'Unavailable'}</dd><dt>Completed</dt><dd>{draw.completed_at ? formatDate(draw.completed_at) : 'Not completed'}</dd></dl></details>
          </article>
        ))}</div>
      ) : <div className="panel empty-state"><span className="empty-icon"><History /></span><strong>No draw history yet</strong><p>Draws you create will appear here with their winners and verification records.</p><Link className="button button-primary button-small" to="/dashboard/draws">Create your first draw</Link></div>}
    </div>
  );
}
