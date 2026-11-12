import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, History, Phone, Plus, RefreshCw, Trophy, Users } from 'lucide-react';
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

  const activeGroup = groups.find((group) => group.id === selected);
  const activeMembers = members.filter((member) => member.status === 'active');
  const paidTotal = contributions.reduce((sum, row) => sum + Number(row.paid_amount), 0);
  const expectedTotal = contributions.reduce((sum, row) => sum + Number(row.expected_amount), 0);
  const wonMemberIds = useMemo(() => new Set(allocations.map((allocation) => allocation.member_id)), [allocations]);
  const eligibleMembers = activeMembers.filter((member) => !wonMemberIds.has(member.id));
  const nextRound = rounds.find((round) => round.status !== 'completed' && round.status !== 'cancelled');

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

  const runMonthlyDraw = async () => {
    if (!supabase || !user || !activeGroup || !nextRound) return;
    if (activeMembers.length < 2) { setError('Add at least two active members before running a draw.'); return; }
    if (eligibleMembers.length < 2) { setError('Every eligible member has already received a payout. Start a new cycle or reset the winner history.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await ensureRoundContributions(nextRound);
      const { data: roundPayments, error: paymentError } = await supabase.from('chitty_contributions').select('status,expected_amount,paid_amount').eq('round_id', nextRound.id);
      if (paymentError) throw paymentError;
      const unpaid = (roundPayments || []).filter((payment) => payment.status !== 'paid' || Number(payment.paid_amount) < Number(payment.expected_amount));
      if (unpaid.length) throw new Error(`${unpaid.length} member contribution(s) are still unpaid. Record all payments before running this round's draw.`);
      const { data: workspaceRows, error: workspaceError } = await supabase.from('workspace_members').select('workspace_id,role').eq('user_id', user.id).in('role', ['owner', 'admin', 'organizer']).order('joined_at', { ascending: true }).limit(1);
      if (workspaceError) throw workspaceError;
      const workspaceId = workspaceRows?.[0]?.workspace_id;
      if (!workspaceId) throw new Error('Your account does not have draw permission in a workspace.');
      const { data: created, error: createError } = await supabase.functions.invoke('create-draw', { body: { workspace_id: workspaceId, title: `${activeGroup.name} · Round ${nextRound.round_number}`, draw_type: 'chitty', winner_count: 1, entries: eligibleMembers.map((member) => ({ entry_key: member.id, display_name: member.display_name })) } });
      if (createError) throw new Error(createError.message);
      if (!created?.draw_id) throw new Error(created?.error || 'Could not create the monthly draw.');
      const { data: result, error: executeError } = await supabase.functions.invoke('execute-draw', { body: { draw_id: created.draw_id } });
      if (executeError) throw new Error(executeError.message);
      const winnerEntryKey = result?.winners?.[0]?.entry_key;
      const winnerName = result?.winners?.[0]?.display_name;
      if (!winnerName || !winnerEntryKey) throw new Error(result?.error || 'The draw did not return a verifiable member identifier.');
      const winner = eligibleMembers.find((member) => member.id === winnerEntryKey);
      if (!winner) throw new Error('The winner could not be matched to a group member. No payout allocation was created.');
      const payout = Number(activeGroup.contribution_amount) * activeMembers.length;
      const { error: completionError } = await supabase.rpc('complete_chitty_round', { p_round_id: nextRound.id, p_member_id: winner.id, p_amount: payout, p_draw_id: created.draw_id });
      if (completionError) throw completionError;
      setNotice(`Round ${nextRound.round_number} winner: ${winner.display_name}. Payout: ${payout.toFixed(3)} BHD.`);
      await loadDetails(); await loadContributions();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
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
        {nextRound && <div className="chitty-draw-action"><div><span className="section-kicker">NEXT PAYOUT</span><h3>Round {nextRound.round_number}</h3><p>{eligibleMembers.length} eligible members. {wonMemberIds.size} previous winners excluded.</p></div><button className="button button-primary" onClick={() => void runMonthlyDraw()} disabled={busy || eligibleMembers.length < 2 || activeMembers.length < 2}><Trophy size={16} /> {busy ? 'Processing…' : 'Run monthly draw'}</button></div>}
      </section>
      {nextRound && <section className="panel"><div className="panel-heading"><div><h2>Contribution tracking</h2><p>Mark each member as paid for the upcoming round.</p></div><CircleDollarSign size={20} /></div><div className="chitty-metrics"><div><span>Collected</span><strong>{paidTotal.toFixed(3)} BHD</strong></div><div><span>Expected</span><strong>{expectedTotal.toFixed(3)} BHD</strong></div><div><span>Outstanding</span><strong>{Math.max(0, expectedTotal - paidTotal).toFixed(3)} BHD</strong></div></div>{contributions.length ? <div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>EXPECTED</th><th>PAID</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{contributions.map((row) => <tr key={row.id}><td>{memberById(row.member_id)}</td><td>{Number(row.expected_amount).toFixed(3)}</td><td>{Number(row.paid_amount).toFixed(3)}</td><td>{row.status}</td><td><button className="button button-small button-secondary" disabled={busy} onClick={() => void markPayment(row, row.status !== 'paid')}>{row.status === 'paid' ? 'Undo payment' : 'Mark paid'}</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><Clock3 size={20} /><p>Contribution records will be generated when you prepare the next monthly draw.</p></div>}</section>}
      <section className="panel"><div className="panel-heading"><div><h2>Payout history</h2><p>Previous winners are excluded from future rounds in this group.</p></div><History size={20} /></div>{allocations.length ? <div className="activity-list">{allocations.map((allocation) => { const round = rounds.find((row) => row.id === allocation.round_id); return <div className="activity-row" key={allocation.id}><div className="activity-info"><strong><Trophy size={15} /> {memberById(allocation.member_id)}</strong><span>Round {round?.round_number ?? '—'} · {formatDate(allocation.allocated_at)}</span></div><strong>{Number(allocation.amount).toFixed(3)} BHD</strong></div>; })}</div> : <div className="empty-state"><CheckCircle2 size={20} /><p>No payouts yet. The first completed monthly draw will appear here.</p></div>}</section>
    </>}
  </div>;
}
