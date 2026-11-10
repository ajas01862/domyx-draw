import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Chrome, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Brand } from '../components/Brand';

export function Auth({ mode }: { mode: 'login' | 'register' }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const navigate = useNavigate(); const { signInWithGoogle } = useAuth(); const register = mode === 'register';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    if (!supabase) { setError('Connect Supabase using the setup guide before signing in.'); setBusy(false); return; }
    try {
      if (register) { const { error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } }); if (authError) throw authError; setMessage('Account created. Check your email to confirm your address, then sign in.'); }
      else { const { error: authError } = await supabase.auth.signInWithPassword({ email, password }); if (authError) throw authError; navigate('/dashboard'); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Authentication failed.'); } finally { setBusy(false); }
  };
  return <div className="auth-page"><div className="auth-left"><Brand /><div className="auth-art"><div className="auth-art-icon"><Sparkles size={28} /></div><span>MAKE EVERY DRAW</span><h2>A moment<br />worth sharing.</h2><p>Bring your people together. Make the selection. Celebrate the result.</p><div className="auth-art-footer"><ShieldCheck size={16} /> Transparent. Simple. Made for everyone.</div></div><small>© {new Date().getFullYear()} Domyx Draw</small></div><div className="auth-right"><Link to="/" className="back-link"><ArrowLeft size={16} /> Back to home</Link><div className="auth-form-wrap"><div className="auth-mobile-brand"><Brand /></div><span className="section-kicker">{register ? 'START SOMETHING GOOD' : 'WELCOME BACK'}</span><h1>{register ? 'Create your account' : 'Welcome back'}</h1><p className="auth-subtitle">{register ? 'Your next big moment is just a few clicks away.' : 'Sign in to continue to your workspace.'}</p><button className="social-button" onClick={async () => { try { await signInWithGoogle(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Google sign-in failed.'); } }}><Chrome size={18} /> Continue with Google</button><div className="auth-divider"><span /> or continue with email <span /></div><form onSubmit={submit} className="form-stack">{register && <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required minLength={2} /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} autoComplete={register ? 'new-password' : 'current-password'} /></label>{error && <div className="alert alert-error">{error}</div>}{message && <div className="alert alert-success">{message}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <Mail size={17} /></button></form><p className="auth-switch">{register ? 'Already have an account?' : "Don't have an account?"} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create one'}</Link></p><p className="auth-terms">By continuing, you agree to our Terms of Service and Privacy Policy.</p></div></div></div>;
}
