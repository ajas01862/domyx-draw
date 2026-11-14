import { Activity, BarChart3, Crown, History, Users, type LucideIcon } from 'lucide-react';
const modules: Record<string, { title: string; description: string; icon: LucideIcon; items: string[] }> = {
  chitty: { title: 'Chitty manager', description: 'Manage your group, member contributions and scheduled rounds.', icon: Users, items: ['Create and manage chitty groups', 'Track members and contribution status', 'Schedule rounds and record allocations', 'Keep a transparent winner history'] },
  rooms: { title: 'Live rooms', description: 'Host a shared room where your audience can follow a draw live.', icon: Activity, items: ['Create public or private rooms', 'Share a room access link', 'Show live room presence', 'Broadcast winner announcements'] },
  history: { title: 'Draw history', description: 'Your completed selections and their verification records.', icon: History, items: ['Review past draws', 'Inspect winner details', 'Open public verification records'] },
  analytics: { title: 'Analytics', description: 'Understand your events, participation and draw activity.', icon: BarChart3, items: ['Track draw volume', 'Review event activity', 'Understand participant trends'] },
  billing: { title: 'Plans & billing', description: 'Start free and upgrade when you need more room to grow.', icon: Crown, items: ['Free plan for getting started', 'Higher limits on premium', 'Advanced branding and analytics', 'Subscription billing integration planned'] },
  settings: { title: 'Settings', description: 'Manage your account and workspace preferences.', icon: Users, items: ['Account profile', 'Authentication and sessions', 'Workspace preferences'] },
};
export function Placeholder({ type }: { type: keyof typeof modules }) {
  const item = modules[type]; const Icon = item.icon;
  return <div className="dashboard-page"><div className="page-heading"><div><span className="section-kicker">DOMYX ACTIVITYDESK</span><h1>{item.title}</h1><p>{item.description}</p></div></div><div className="coming-panel"><div className="coming-icon"><Icon size={28} /></div><span className="coming-label">MODULE FOUNDATION</span><h2>{item.title} is on the roadmap.</h2><p>This module is represented in the architecture and navigation. Its complete workflow is not enabled in this initial repository build.</p><div className="coming-list">{item.items.map((text) => <div key={text}><span>✓</span>{text}</div>)}</div></div></div>;
}
