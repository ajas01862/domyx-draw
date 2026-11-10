import { AppRouter } from './router';
import { AuthProvider } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
export function App() { return <AuthProvider>{!isSupabaseConfigured && <div className="config-banner">Supabase is not configured yet. Add your project URL and anon key to .env.local and GitHub Actions variables. See README.</div>}<AppRouter /></AuthProvider>; }
