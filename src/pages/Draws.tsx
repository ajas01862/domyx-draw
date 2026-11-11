import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dices, FileUp, Plus, RefreshCw, ShieldCheck, Trophy, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/Modal';
import { formatDate } from '../lib/utils';
import type { DrawRecord } from '../types';

async function getFunctionError(error: unknown) {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === 'string') return body.error;
      } catch {
        // Fall back to the SDK error message.
      }
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function Draws() {
  const { user } = useAuth();
  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [entries, setEntries] = useState('');
  const [winnerCount, setWinnerCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ drawId: string; winners: string[]; commitment?: string; reveal?: string; snapshotHash?: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) {
      setDraws([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: loadError } = await supabase.from('draws').select('id,title,draw_type,status,participant_count,winner_count,created_at').order('created_at', { ascending: false }).limit(100);
    if (loadError) setError(loadError.message);
    else setDraws((data || []) as DrawRecord[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const parsedEntries = useMemo(() => [...new Set(entries.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean))], [entries]);

  const importFile = async (file?: File) => {
    if (!file) return;
    const content = await file.text();
    setEntries((current) => current ? `${current}\n${content}` : content);
  };

  const createAndRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    if (!supabase || !user) {
      setError('Connect Supabase and sign in first.');
      setBusy(false);
      return;
    }
    if (parsedEntries.length < 2) {
      setError('Add at least two unique participants.');
      setBusy(false);
      return;
    }
    if (winnerCount < 1 || winnerCount >= parsedEntries.length || winnerCount > 100) {
      setError('Winner count must be at least 1, no more than 100, and lower than the participant count.');
      setBusy(false);
      return;
    }

    try {
      const { data: memberships, error: workspaceError } = await supabase.from('workspace_members').select('workspace_id,role').eq('user_id', user.id).in('role', ['owner', 'admin', 'organizer']).order('joined_at', { ascending: true }).limit(1);
      if (workspaceError) throw workspaceError;
      const workspace = memberships?.[0];
      if (!workspace) throw new Error('No workspace with draw permissions was found for this account. Ask a workspace owner to grant organizer access.');

      const { data: draw, error: drawError } = await supabase.functions.invoke('create-draw', {
        body: {
          workspace_id: workspace.workspace_id,
          title: title.trim(),
          draw_type: 'random',
          winner_count: winnerCount,
          entries: parsedEntries.map((display_name, index) => ({ entry_key: `${index}-${display_name.toLowerCase()}`, display_name })),
        },
      });
      if (drawError) throw new Error(await getFunctionError(drawError));
      if (!draw?.draw_id) throw new Error(draw?.error || 'Draw could not be created.');

      const { data: result, error: runError } = await supabase.functions.invoke('execute-draw', { body: { draw_id: draw.draw_id } });
      if (runError) throw new Error(await getFunctionError(runError));
      if (!Array.isArray(result?.winners) || !result.winners.length) throw new Error(result?.error || 'The draw was created but no winner result was returned. Check History before retrying.');

      setResults({
        drawId: draw.draw_id,
        winners: result.winners.map((winner: { display_name: string }) => winner.display_name),
        commitment: result.seed_commitment,
        reveal: result.seed_reveal,
        snapshotHash: result.snapshot_hash,
      });
      setMessage('Your draw was completed and saved.');
      setModal(false);
      setTitle('');
      setEntries('');
      setWinnerCount(1);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div><span className="section-kicker">PICK WITH CONFIDENCE</span><h1>Random draws</h1><p>Create a draw, add participants and let the moment happen.</p></div>
        <button className="button button-primary" onClick={() => { setError(''); setModal(true); }}><Plus size={17} /> New draw</button>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {results && (
        <section className="result-banner draw-result">
          <div className="result-icon"><Trophy size={25} /></div>
          <div className="draw-result-content"><span className="section-kicker">DRAW COMPLETE</span><h2>{results.winners.length === 1 ? results.winners[0] : `${results.winners.length} winners selected`}</h2><p>{results.winners.join(' · ')}</p><small>Draw ID: {results.drawId}</small>
            <details className="verification-details"><summary>Fairness and verification data</summary><dl><dt>Seed commitment</dt><dd>{results.commitment || 'Not returned'}</dd><dt>Revealed seed</dt><dd>{results.reveal || 'Not returned'}</dd><dt>Participant snapshot hash</dt><dd>{results.snapshotHash || 'Not returned'}</dd></dl></details>
          </div>
          <button className="button button-secondary button-small" onClick={() => setResults(null)}>Dismiss</button>
        </section>
      )}
      <div className="info-strip"><ShieldCheck size={18} /><span>Winner selection runs on the Supabase server. The participant snapshot and seed commitment are recorded before selection.</span></div>
      <div className="panel table-panel">
        <div className="panel-heading"><div><h2>All draws</h2><p>{draws.length} recorded draws</p></div><button className="icon-button" onClick={() => { setError(''); void load(); }} aria-label="Refresh draws"><RefreshCw size={17} /></button></div>
        {loading ? <div className="empty-state"><span className="spinner" /> Loading draws…</div> : draws.length ? (
          <div className="table-wrap"><table><thead><tr><th>DRAW</th><th>TYPE</th><th>PARTICIPANTS</th><th>WINNERS</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>{draws.map((draw) => <tr key={draw.id}><td><strong>{draw.title}</strong><small className="table-sub">{draw.id.slice(0, 8)}</small></td><td>{draw.draw_type}</td><td><Users size={14} /> {draw.participant_count}</td><td>{draw.winner_count}</td><td><span className={`status-pill status-${draw.status}`}>{draw.status}</span></td><td>{formatDate(draw.created_at)}</td></tr>)}</tbody></table></div>
        ) : (
          <div className="empty-state"><span className="empty-icon"><Dices /></span><strong>Your first draw is waiting</strong><p>Add a list of names and select your winner in seconds.</p><button className="button button-primary button-small" onClick={() => setModal(true)}>Create a draw <Plus size={15} /></button></div>
        )}
      </div>
      {modal && <Modal title="Create a random draw" onClose={() => !busy && setModal(false)}><form className="form-stack modal-form" onSubmit={createAndRun}>
        <label>Draw title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Community giveaway" required maxLength={120} /></label>
        <label>Participants <span className="field-hint">One name per line or comma-separated. Duplicate names are counted once.</span><textarea value={entries} onChange={(event) => setEntries(event.target.value)} placeholder={'Alex Morgan\nJordan Lee\nSam Rivera'} rows={7} required /></label>
        <div className="import-row"><label className="file-button"><FileUp size={16} /> Import text / CSV<input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><span>{parsedEntries.length} unique entries</span></div>
        <label>Number of winners<input type="number" min={1} max={Math.max(1, Math.min(100, parsedEntries.length - 1))} value={winnerCount} onChange={(event) => setWinnerCount(Number(event.target.value))} /></label>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="button button-primary button-full" disabled={busy}>{busy ? 'Creating and drawing…' : 'Create & select winner'} <Trophy size={16} /></button>
        <p className="form-footnote">This creates a saved draw and immediately selects the winner(s). A completed draw cannot be rerun.</p>
      </form></Modal>}
    </div>
  );
}
