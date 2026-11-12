import { useEffect, useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function Settings() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setUsername(profile?.username || '');
    setLoading(false);
  }, [profile]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !user) return;
    setBusy(true); setError(''); setMessage('');
    const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName.trim() || null, username: username.trim() || null }).eq('id', user.id);
    if (updateError) setError(updateError.message);
    else setMessage('Profile settings saved. Refresh the page to update the account label.');
    setBusy(false);
  };

  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">ACCOUNT</span><h1>Settings</h1><p>Manage your profile and account details.</p></div></div>{error && <div className="alert alert-error">{error}</div>}{message && <div className="alert alert-success">{message}</div>}<section className="panel settings-panel"><div className="panel-heading"><div><h2>Profile information</h2><p>These details are associated with your signed-in account.</p></div><ShieldCheck size={20} /></div>{loading ? <div className="empty-state">Loading settings…</div> : <form className="form-stack" onSubmit={save}><label>Email address<input value={user?.email || ''} readOnly disabled /></label><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} placeholder="Your name" /></label><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={40} pattern="[A-Za-z0-9_]*" placeholder="username" /></label><button className="button button-primary" disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save settings'}</button></form>}</section></div>;
}
