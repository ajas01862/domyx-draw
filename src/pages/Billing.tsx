import { useEffect, useState } from 'react';
import { Check, Crown, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Plan = { id: string; name: string; slug: string; price_monthly: number; limits: Record<string, unknown>; features: Record<string, unknown> };
type Subscription = { status: string; started_at: string; expires_at: string | null; plans: { name: string; price_monthly: number } | null };

export function Billing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!supabase || !user) { setLoading(false); return; }
    setLoading(true); setError('');
    const [planResult, subscriptionResult] = await Promise.all([
      supabase.from('plans').select('id,name,slug,price_monthly,limits,features').eq('is_active', true).order('price_monthly'),
      supabase.from('subscriptions').select('status,started_at,expires_at,plans(name,price_monthly)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (planResult.error || subscriptionResult.error) setError(planResult.error?.message || subscriptionResult.error?.message || 'Could not load billing details.');
    setPlans((planResult.data || []) as Plan[]);
    setSubscription(subscriptionResult.data as unknown as Subscription | null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user]);
  const activePlan = subscription?.plans?.name || 'Free';

  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">ACCOUNT</span><h1>Plans & billing</h1><p>Review your current plan, available plans and subscription status.</p></div><button className="button button-secondary" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button></div>{error && <div className="alert alert-error">{error}</div>}<section className="panel"><div className="panel-heading"><div><h2>Current subscription</h2><p>Your account's latest subscription record.</p></div><Crown size={20} /></div>{loading ? <div className="empty-state">Loading billing…</div> : <div className="activity-list"><div className="activity-row"><div className="activity-info"><strong>{activePlan} plan</strong><span>Status: {subscription?.status || 'No subscription record'}</span></div><strong>{subscription?.plans?.price_monthly ? `${Number(subscription.plans.price_monthly).toFixed(2)}/month` : 'Free'}</strong></div>{subscription?.expires_at && <p className="history-pending">Expires {new Date(subscription.expires_at).toLocaleDateString()}</p>}</div>}</section><div className="stats-grid">{plans.map((plan) => <article className="panel plan-card" key={plan.id}><span className="section-kicker">{plan.slug.toUpperCase()}</span><h2>{plan.name}</h2><strong className="stat-value">{Number(plan.price_monthly) === 0 ? 'Free' : `${Number(plan.price_monthly).toFixed(2)}/mo`}</strong><div className="coming-list">{Object.entries(plan.features || {}).filter(([, enabled]) => enabled === true).map(([feature]) => <div key={feature}><Check size={15} />{feature.replaceAll('_', ' ')}</div>)}</div><p className="history-pending">Plan changes and online payments are not enabled because no payment provider is configured.</p></article>)}</div></div>;
}
