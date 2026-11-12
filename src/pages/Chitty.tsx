import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentWorkspaceId } from '../lib/workspace';

type Group = { id: string; name: string; description: string | null; currency: string; contribution_amount: number; frequency: string; total_rounds: number; status: string; created_at: string };
type Member = { id: string; display_name: string; contact: string | null; status: string };

export function Chitty() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [rounds, setRounds] = useState('12');
  const [memberName, setMemberName] = useState('');
  const [contact, setContact] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase.from('chitty_groups').select('id,name,description,currency,contribution_amount,frequency,total_rounds,status,created_at').order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else {
      const rows = (data || []) as Group[];
      setGroups(rows);
      setSelected((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id || '');
    }
    setLoading(false);
  }, [user]);

  const loadMembers = useCallback(async () => {
    if (!supabase || !selected) { setMembers([]); return; }
    const { data, error: queryError } = await supabase.from('chitty_members').select('id,display_name,contact,status').eq('group_id', selected).order('joined_at');
    if (queryError) setError(queryError.message);
    else setMembers((data || []) as Member[]);
  }, [selected]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMembers(); }, [loadMembers]);

  const createGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !user) return;
    setBusy(true); setError('');
    try {
      const workspaceId = await getCurrentWorkspaceId(user.id);
      const { data, error: insertError } = await supabase.from('chitty_groups').insert({ workspace_id: workspaceId, created_by: user.id, name: name.trim(), contribution_amount: Number(amount), total_rounds: Number(rounds), currency: 'BHD', frequency: 'monthly' }).select('id').single();
      if (insertError) throw insertError;
      const roundRows = Array.from({ length: Number(rounds) }, (_, index) => ({ group_id: data.id, round_number: index + 1, status: 'scheduled' }));
      const { error: roundsError } = await supabase.from('chitty_rounds').insert(roundRows);
      if (roundsError) throw roundsError;
      setName(''); setAmount(''); await load(); setSelected(data.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create group.'); }
    finally { setBusy(false); }
  };

  const addMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !selected) return;
    setBusy(true); setError('');
    const { error: insertError } = await supabase.from('chitty_members').insert({ group_id: selected, display_name: memberName.trim(), contact: contact.trim() || null });
    if (insertError) setError(insertError.message);
    else { setMemberName(''); setContact(''); await loadMembers(); }
    setBusy(false);
  };

  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">GROUP FINANCE</span><h1>Chitty manager</h1><p>Manage rotating savings groups, members and contribution rounds.</p></div><button className="button button-secondary" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button></div>{error && <div className="alert alert-error">{error}</div>}<div className="dashboard-columns"><section className="panel"><div className="panel-heading"><div><h2>Create a group</h2><p>Start a new contribution cycle</p></div><Users size={20} /></div><form className="form-stack" onSubmit={createGroup}><label>Group name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} placeholder="Family savings" /></label><label>Contribution per member (BHD)<input type="number" min="0.001" step="0.001" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label>Number of rounds<input type="number" min="1" max="120" value={rounds} onChange={(event) => setRounds(event.target.value)} required /></label><button className="button button-primary" disabled={busy}><Plus size={16} /> {busy ? 'Creating…' : 'Create group'}</button></form></section><section className="panel"><div className="panel-heading"><div><h2>Your groups</h2><p>{groups.length} group{groups.length === 1 ? '' : 's'} available</p></div></div>{loading ? <div className="empty-state">Loading groups…</div> : groups.length ? <div className="form-stack"><label>Select group<select value={selected} onChange={(event) => setSelected(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>{groups.filter((group) => group.id === selected).map((group) => <div className="activity-list" key={group.id}><div className="activity-row"><div className="activity-info"><strong>{group.name}</strong><span>{group.frequency} · {group.total_rounds} rounds · {group.status}</span></div><strong>{Number(group.contribution_amount).toFixed(3)} {group.currency}</strong></div></div>)}</div> : <div className="empty-state">No groups yet. Create your first group.</div>}</section></div>{selected && <section className="panel"><div className="panel-heading"><div><h2>Members</h2><p>{members.length} registered members</p></div></div><form className="inline-form" onSubmit={addMember}><input aria-label="Member name" value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Member name" required /><input aria-label="Contact" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Phone or contact (optional)" /><button className="button button-primary" disabled={busy}><Plus size={16} /> Add member</button></form>{members.length ? <div className="activity-list">{members.map((member) => <div className="activity-row" key={member.id}><div className="activity-info"><strong>{member.display_name}</strong><span>{member.contact || 'No contact'} · {member.status}</span></div></div>)}</div> : <div className="empty-state">No members added yet.</div>}</section>}</div>;
}
