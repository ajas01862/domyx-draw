import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Copy, ExternalLink, History, Phone, Plus, RefreshCw, Radio, Trophy, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentWorkspaceId } from '../lib/workspace';
import { formatDate } from '../lib/utils';

type Group = { id: string; name: string; description: string | null; currency: string; contribution_amount: number; frequency: string; total_rounds: number; status: string; start_date: string | null; created_at: string };
type Member = { id: string; display_name: string; contact: string | null; status: string; joined_at: string };
type Round = { id: string; round_number: number; scheduled_at: string | null; status: string; draw_id: string | null };
type Contribution = { id: string; member_id: string; expected_amount: number; paid_amount: number; status: string; paid_at: string | null; note: string | null };
type Allocation = { id: string; round_id: string; member_id: string; amount: number; allocated_at: string };

function monthDate(start: string, index: number) {
  const date = new Date(`${start}T12:00:00`);
  date.setMonth(date.getMonth() + index);
  return date.toISOString();
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function Chitty() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [groupName, setGroupName] = useState('');
  const [amount, setAmount] = useState('');
  const [roundCount, setRoundCount] = useState('12');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [memberName, setMemberName] = useState('');
  const [phone, setPhone] = useState('');
  const [liveSession, setLiveSession] = useState<{ id: string; public_token: string; status: string; draw_id: string } | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);

  const activeGroup = groups.find((group) => group.id === selected);
  const activeMembers = members.filter((member) => member.status === 'active');
  const paidTotal = contributions.reduce((sum, row) => sum + Number(row.paid_amount), 0);
  const expectedTotal = contributions.reduce((sum, row) => sum + Number(row.expected_amount), 0);
  const wonMemberIds = useMemo(() => new Set(allocations.map((allocation) => allocation.member_id)), [allocations]);
  const eligibleMembers = activeMembers.filter((member) => !wonMemberIds.has(member.id));
  const nextRound = rounds.find((round) => round.status !== 'completed' && round.status !== 'cancelled');
  const liveUrl = liveSession ? `${window.location.origin}${import.meta.env.BASE_URL}chitty/live/${liveSession.public_token}` : '';

  const loadGroups = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase.from('chitty_groups').select('id,name,description,currency,contribution_amount,frequency,total_rounds,status,start_date,created_at').order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else {
      const rows = (data || []) as Group[];
      setGroups(rows);
      setSelected((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id || '');
    }
    setLoading(false);
  }, [user]);

  const loadDetails = useCallback(async () => {
    if (!supabase || !selected) {
      setMembers([]); setRounds([]); setContributions([]); setAllocations([]);
      return;
    }
    setError('');
    const [memberResult, roundResult, allocationResult] = await Promise.all([
      supabase.from('chitty_members').select('id,display_name,contact,status,joined_at').eq('group_id', selected).order('joined_at'),
      supabase.from('chitty_rounds').select('id,round_number,scheduled_at,status,draw_id').eq('group_id', selected).order('round_number'),
      supabase.from('chitty_allocations').select('id,round_id,member_id,amount,allocated_at').order('allocated_at'),
    ]);
    if (memberResult.error) setError(memberResult.error.message);
    else setMembers((memberResult.data || []) as Member[]);
    if (roundResult.error) setError(roundResult.error.message);
    else setRounds((roundResult.data || []) as Round[]);
    const upcomingRound = ((roundResult.data || []) as Round[]).find((round) => round.status !== 'completed' && round.status !== 'cancelled');
    if (upcomingRound) {
      const { data: liveData, error: liveError } = await supabase.from('chitty_live_sessions').select('id,public_token,status,draw_id').eq('round_id', upcomingRound.id).maybeSingle();
      if (liveError) setError(liveError.message);
      else setLiveSession(liveData as { id: string; public_token: string; status: string; draw_id: string } | null);
    } else setLiveSession(null);
    if (allocationResult.error) setError(allocationResult.error.message);
    else {
      const roundIds = new Set((roundResult.data || []).map((round) => round.id));
      setAllocations(((allocationResult.data || []) as Allocation[]).filter((row) => roundIds.has(row.round_id)));
    }
  }, [selected]);

  const loadContributions = useCallback(async () => {
    if (!supabase || !nextRound) { setContributions([]); return; }
    const { data, error: queryError } = await supabase.from('chitty_contributions').select('id,member_id,expected_amount,paid_amount,status,paid_at,note').eq('round_id', nextRound.id);
    if (queryError) setError(queryError.message);
    else setContributions((data || []) as Contribution[]);
  }, [nextRound?.id]);

  useEffect(() => { void loadGroups(); }, [loadGroups]);
  useEffect(() => { void loadDetails(); }, [loadDetails]);
  useEffect(() => {
    void loadContributions();
  }, [loadContributions]);

  useEffect(() => {
    if (!supabase || !nextRound || !activeGroup || !activeMembers.length) return;
    const rows = activeMembers.map((member) => ({ round_id: nextRound.id, member_id: member.id, expected_amount: Number(activeGroup.contribution_amount), paid_amount: 0, status: 'unpaid' }));
    void supabase.from('chitty_contributions').upsert(rows, { onConflict: 'round_id,member_id', ignoreDuplicates: true }).then(({ error: insertError }) => {
      if (insertError) setError(insertError.message);
      else void loadContributions();
    });
  }, [nextRound?.id, activeGroup?.id, activeMembers.length, loadContributions]);

  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !user) return;
    const count = Number(roundCount);
    const contribution = Number(amount);
    if (!Number.isFinite(contribution) || contribution <= 0 || !Number.isInteger(count) || count < 1 || count > 120) {
      setError('Enter a valid contribution amount and between 1 and 120 monthly rounds.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const workspaceId = await getCurrentWorkspaceId(user.id);
      const { data, error: insertError } = await supabase.from('chitty_groups').insert({ workspace_id: workspaceId, created_by: user.id, name: groupName.trim(), contribution_amount: contribution, total_rounds: count, currency: 'BHD', frequency: 'monthly', start_date: startDate }).select('id').single();
      if (insertError) throw insertError;
      const roundRows = Array.from({ length: count }, (_, index) => ({ group_id: data.id, round_number: index + 1, scheduled_at: monthDate(startDate, index), status: 'scheduled' }));
      const { error: roundsError } = await supabase.from('chitty_rounds').insert(roundRows);
      if (roundsError) {
        await supabase.from('chitty_groups').delete().eq('id', data.id);
        throw roundsError;
      }
      setGroupName(''); setAmount(''); setNotice('Group and monthly schedule created. Add members to prepare the first round.');
      await loadGroups(); setSelected(data.id);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  };

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !selected) return;
    const cleanPhone = phone.trim();
    if (cleanPhone && !/^\+?[0-9\s()-]{6,20}$/.test(cleanPhone)) { setError('Enter a valid phone number, including country code if needed.'); return; }
    setBusy(true); setError('');
    try {
      const { error: insertError } = await supabase.from('chitty_members').insert({ group_id: selected, display_name: memberName.trim(), contact: cleanPhone || null });
      if (insertError) throw insertError;
      setMemberName(''); setPhone(''); await loadDetails(); setNotice('Member added successfully.');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  };

  const ensureRoundContributions = async (round: Round) => {
    if (!supabase || !activeGroup) return;
    const rows = activeMembers.map((member) => ({ round_id: round.id, member_id: member.id, expected_amount: Number(activeGroup.contribution_amount), paid_amount: 0, status: 'unpaid' }));
    if (rows.length) {
      const { error: insertError } = await supabase.from('chitty_contributions').upsert(rows, { onConflict: 'round_id,member_id', ignoreDuplicates: true });
      if (insertError) throw insertError;
    }
  };

  const markPayment = async (row: Contribution, paid: boolean) => {
    if (!supabase) return;
    setBusy(true); setError('');
    const paidAmount = paid ? Number(row.expected_amount) : 0;
    const { error: updateError } = await supabase.from('chitty_contributions').update({ paid_amount: paidAmount, status: paid ? 'paid' : 'unpaid', paid_at: paid ? new Date().toISOString() : null }).eq('id', row.id);
    if (updateError) setError(updateError.message);
    else await loadContributions();
    setBusy(false);
  };

  const createLiveLink = async () => {
    if (!supabase || !user || !activeGroup || !nextRound) return;
    if (eligibleMembers.length < 2) { setError('At least two eligible members are required.'); return; }
    setLiveBusy(true); setError(''); setNotice('');
    try {
      await ensureRoundContributions(nextRound);
      const { data: payments, error: paymentError } = await supabase.from('chitty_contributions').select('status,expected_amount,paid_amount').eq('round_id', nextRound.id);
      if (paymentError) throw paymentError;
      const unpaid = (payments || []).filter((row) => row.status !== 'paid' || Number(row.paid_amount) < Number(row.expected_amount));
      if (unpaid.length) throw new Error(`${unpaid.length} contribution(s) are still unpaid. Complete payment tracking before preparing the live draw.`);
      const workspaceId = await getCurrentWorkspaceId(user.id);
      const { data: draw, error: drawError } = await supabase.functions.invoke('create-draw', { body: { workspace_id: workspaceId, title: `${activeGroup.name} · Round ${nextRound.round_number}`, draw_type: 'chitty', winner_count: 1, entries: eligibleMembers.map((member) => ({ entry_key: member.id, display_name: member.display_name })) } });
      if (drawError) throw new Error(drawError.message);
      if (!draw?.draw_id) throw new Error(draw?.error || 'Could not create the draw snapshot.');
      const participants = eligibleMembers.map((member) => ({ id: member.id, name: member.display_name }));
      const { data: session, error: sessionError } = await supabase.from('chitty_live_sessions').insert({ group_id: activeGroup.id, round_id: nextRound.id, draw_id: draw.draw_id, participants, status: 'hosted' }).select('id,public_token,status,draw_id').single();
      if (sessionError) throw sessionError;
      setLiveSession(session);
      setNotice('Live link created. Share it with your members, then mark the draw ready when everyone is watching.');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLiveBusy(false); }
  };

  const setLiveReady = async () => {
    if (!supabase || !liveSession) return;
    setLiveBusy(true); setError('');
    const { error: updateError } = await supabase.from('chitty_live_sessions').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', liveSession.id);
    if (updateError) setError(updateError.message);
    else { setLiveSession({ ...liveSession, status: 'ready' }); setNotice('Draw is ready. Press Start live draw when you are ready.'); }
    setLiveBusy(false);
  };

  const startLiveDraw = async () => {
    if (!supabase || !user || !activeGroup || !nextRound || !liveSession) return;
    setLiveBusy(true); setError(''); setNotice('');
    try {
      const { error: runningError } = await supabase.from('chitty_live_sessions').update({ status: 'running', current_index: -1, current_name: 'The selection is starting…', updated_at: new Date().toISOString() }).eq('id', liveSession.id);
      if (runningError) throw runningError;
      setLiveSession({ ...liveSession, status: 'running' });
      const { data: result, error: executeError } = await supabase.functions.invoke('execute-draw', { body: { draw_id: liveSession.draw_id } });
      if (executeError) throw new Error(executeError.message);
      const winnerKey = result?.winners?.[0]?.entry_key;
      const winner = eligibleMembers.find((member) => member.id === winnerKey);
      if (!winner) throw new Error(result?.error || 'The server returned an unknown winner.');
      await new Promise((resolve) => window.setTimeout(resolve, 4500));
      const payout = Number(activeGroup.contribution_amount) * activeMembers.length;
      const { error: completionError } = await supabase.rpc('complete_chitty_round', { p_round_id: nextRound.id, p_member_id: winner.id, p_amount: payout, p_draw_id: liveSession.draw_id });
      if (completionError) throw completionError;
      const { error: finishError } = await supabase.from('chitty_live_sessions').update({ status: 'completed', winner_member_id: winner.id, winner_name: winner.display_name, current_name: winner.display_name, updated_at: new Date().toISOString() }).eq('id', liveSession.id);
      if (finishError) throw finishError;
      setLiveSession({ ...liveSession, status: 'completed' });
      setNotice(`Round ${nextRound.round_number} winner: ${winner.display_name}. Payout: ${payout.toFixed(3)} BHD.`);
      await loadDetails(); await loadContributions();
    } catch (caught) {
      setError(errorMessage(caught));
      await supabase.from('chitty_live_sessions').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', liveSession.id);
      setLiveSession({ ...liveSession, status: 'ready' });
    } finally { setLiveBusy(false); }
  };

  const memberById = (id: string) => members.find((member) => member.id === id)?.display_name || 'Former member';

  return <div className="dashboard-page chitty-page">
    <div className="page-heading"><div><span className="section-kicker">ROTATING SAVINGS MANAGEMENT</span><h1>Chitty manager</h1><p>Manage monthly contributions, member eligibility, payouts and a transparent winner history.</p></div><button className="button button-secondary" onClick={() => { void loadGroups(); void loadDetails(); }}><RefreshCw size={16} /> Refresh</button></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="dashboard-columns">
      <section className="panel"><div className="panel-heading"><div><h2>Create a group</h2><p>Build a monthly savings cycle</p></div><Users size={20} /></div><form className="form-stack" onSubmit={createGroup}><label>Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} required maxLength={100} placeholder="Family savings" /></label><label>Monthly contribution per member (BHD)<input type="number" min="0.001" step="0.001" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="10.000" /></label><label>Number of monthly rounds<input type="number" min="1" max="120" value={roundCount} onChange={(event) => setRoundCount(event.target.value)} required /></label><label>First round date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label><button className="button button-primary" disabled={busy}><Plus size={16} /> {busy ? 'Creating…' : 'Create monthly group'}</button></form></section>
      <section className="panel"><div className="panel-heading"><div><h2>Your groups</h2><p>{groups.length} savings group{groups.length === 1 ? '' : 's'}</p></div></div>{loading ? <div className="empty-state">Loading groups…</div> : groups.length ? <div className="form-stack"><label>Select group<select value={selected} onChange={(event) => setSelected(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>{activeGroup && <><div className="chitty-metrics"><div><span>Contribution</span><strong>{Number(activeGroup.contribution_amount).toFixed(3)} {activeGroup.currency}</strong></div><div><span>Cycle</span><strong>{activeGroup.total_rounds} months</strong></div><div><span>Eligible</span><strong>{eligibleMembers.length}/{activeMembers.length}</strong></div></div><p className="field-hint">{activeGroup.status} · Starts {activeGroup.start_date || 'Not scheduled'} · Previous winners are excluded automatically.</p></>}</div> : <div className="empty-state">No groups yet. Create your first group.</div>}</section>
    </div>
    {activeGroup && <>
      <section className="panel"><div className="panel-heading"><div><h2>Members & contact details</h2><p>{activeMembers.length} active members · Add a name and mobile number separately</p></div><Users size={20} /></div><form className="chitty-member-form" onSubmit={addMember}><label><span>Member name</span><input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Enter full name" autoComplete="name" required maxLength={100} /></label><label><span>Phone number</span><div className="phone-input"><Phone size={16} /><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+973 3XXX XXXX" maxLength={20} /></div></label><button className="button button-primary" disabled={busy}><Plus size={16} /> Add member</button></form>{members.length ? <div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>PHONE NUMBER</th><th>STATUS</th><th>WIN HISTORY</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{member.display_name}</strong></td><td>{member.contact || '—'}</td><td><span className={`status-pill status-${member.status}`}>{member.status}</span></td><td>{wonMemberIds.has(member.id) ? <span className="status-pill status-completed">Previous winner</span> : 'Eligible'}</td></tr>)}</tbody></table></div> : <div className="empty-state">Add members to create the contribution schedule.</div>}</section>
      <section className="panel"><div className="panel-heading"><div><h2>Monthly rounds</h2><p>Each round collects contributions and selects one eligible payout recipient.</p></div><CalendarDays size={20} /></div>{rounds.length ? <div className="table-wrap"><table><thead><tr><th>ROUND</th><th>SCHEDULED</th><th>STATUS</th><th>PAYOUT</th></tr></thead><tbody>{rounds.map((round) => { const allocation = allocations.find((row) => row.round_id === round.id); return <tr key={round.id}><td><strong>Round {round.round_number}</strong></td><td>{round.scheduled_at ? formatDate(round.scheduled_at) : 'Not scheduled'}</td><td><span className={`status-pill status-${round.status}`}>{round.status}</span></td><td>{allocation ? <strong>{memberById(allocation.member_id)} · {Number(allocation.amount).toFixed(3)} BHD</strong> : 'Pending'}</td></tr>; })}</tbody></table></div> : <div className="empty-state">No rounds scheduled.</div>}
        {nextRound && <div className="chitty-draw-action"><div><span className="section-kicker">NEXT PAYOUT</span><h3>Round {nextRound.round_number}</h3><p>{eligibleMembers.length} eligible members. {wonMemberIds.size} previous winners excluded.</p></div><span className="status-pill status-ready">Create a live link to begin</span></div>}
      </section>
      {nextRound && <section className="panel chitty-host-panel"><div className="panel-heading"><div><span className="section-kicker">HOST A LIVE DRAW</span><h2>Share the moment</h2><p>Create a private host link first, invite members to watch, then prepare and start the selection.</p></div><Radio size={20} /></div>{!liveSession ? <button className="button button-primary" onClick={() => void createLiveLink()} disabled={liveBusy || eligibleMembers.length < 2}><Plus size={16} /> {liveBusy ? 'Creating link…' : 'Create live link'}</button> : <><div className="live-link-copy"><input readOnly value={liveUrl} aria-label="Shareable live draw link" /><button className="button button-secondary" onClick={() => { void navigator.clipboard.writeText(liveUrl); setNotice('Live link copied.'); }}><Copy size={16} /> Copy link</button><a className="button button-secondary" href={liveUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Preview</a></div><div className="live-host-steps"><span className={liveSession.status === 'hosted' ? 'current' : 'done'}>1. Link created</span><span className={liveSession.status === 'ready' || liveSession.status === 'running' || liveSession.status === 'completed' ? 'done' : ''}>2. Draw ready</span><span className={liveSession.status === 'running' || liveSession.status === 'completed' ? 'done' : ''}>3. Live selection</span></div><div className="live-host-actions">{liveSession.status === 'hosted' && <button className="button button-primary" onClick={() => void setLiveReady()} disabled={liveBusy}>Mark draw ready</button>}{liveSession.status === 'ready' && <button className="button button-primary" onClick={() => void startLiveDraw()} disabled={liveBusy}><Trophy size={16} /> {liveBusy ? 'Selecting…' : 'Start live draw'}</button>}{liveSession.status === 'running' && <span className="live-running-label"><i /> Live selection in progress</span>}{liveSession.status === 'completed' && <span className="status-pill status-completed">Winner recorded</span>}</div></>}</section>}
      {nextRound && <section className="panel"><div className="panel-heading"><div><h2>Contribution tracking</h2><p>Mark each member as paid for the upcoming round.</p></div><CircleDollarSign size={20} /></div><div className="chitty-metrics"><div><span>Collected</span><strong>{paidTotal.toFixed(3)} BHD</strong></div><div><span>Expected</span><strong>{expectedTotal.toFixed(3)} BHD</strong></div><div><span>Outstanding</span><strong>{Math.max(0, expectedTotal - paidTotal).toFixed(3)} BHD</strong></div></div>{contributions.length ? <div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>EXPECTED</th><th>PAID</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{contributions.map((row) => <tr key={row.id}><td>{memberById(row.member_id)}</td><td>{Number(row.expected_amount).toFixed(3)}</td><td>{Number(row.paid_amount).toFixed(3)}</td><td>{row.status}</td><td><button className="button button-small button-secondary" disabled={busy} onClick={() => void markPayment(row, row.status !== 'paid')}>{row.status === 'paid' ? 'Undo payment' : 'Mark paid'}</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><Clock3 size={20} /><p>Contribution records will be generated when you prepare the next monthly draw.</p></div>}</section>}
      <section className="panel"><div className="panel-heading"><div><h2>Payout history</h2><p>Previous winners are excluded from future rounds in this group.</p></div><History size={20} /></div>{allocations.length ? <div className="activity-list">{allocations.map((allocation) => { const round = rounds.find((row) => row.id === allocation.round_id); return <div className="activity-row" key={allocation.id}><div className="activity-info"><strong><Trophy size={15} /> {memberById(allocation.member_id)}</strong><span>Round {round?.round_number ?? '—'} · {formatDate(allocation.allocated_at)}</span></div><strong>{Number(allocation.amount).toFixed(3)} BHD</strong></div>; })}</div> : <div className="empty-state"><CheckCircle2 size={20} /><p>No payouts yet. The first completed monthly draw will appear here.</p></div>}</section>
    </>}
  </div>;
}
