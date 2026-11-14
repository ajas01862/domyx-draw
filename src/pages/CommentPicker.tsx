import { useMemo, useState } from 'react';
import { Check, ClipboardPaste, Download, FileUp, Filter, Instagram, RotateCcw, ShieldCheck, Shuffle, Trophy, Users, Youtube } from 'lucide-react';

type Platform = 'Instagram' | 'YouTube' | 'Facebook' | 'X' | 'TikTok' | 'Other';
type CommentEntry = { id: string; username: string; comment: string; platform: Platform };

const platforms: Platform[] = ['Instagram', 'YouTube', 'Facebook', 'X', 'TikTok', 'Other'];

function parseComments(value: string, platform: Platform): CommentEntry[] {
  return value.split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || /^(username|user|handle|author)\s*[,\t]/i.test(trimmed)) return null;
    const tabParts = trimmed.split(/\t+/);
    const csvParts = trimmed.match(/^(?:\"([^\"]*)\"|([^,]*)),(?:\"([^\"]*)\"|([^,]*))(?:,(.*))?$/);
    if (tabParts.length >= 2) return { id: `${index}-${trimmed}`, username: tabParts[0].replace(/^@/, '').trim() || `Participant ${index + 1}`, comment: tabParts.slice(1).join(' ').trim(), platform };
    if (csvParts) {
      const username = (csvParts[1] ?? csvParts[2] ?? '').trim().replace(/^@/, '');
      const comment = [csvParts[3] ?? csvParts[4] ?? '', csvParts[5] ?? ''].filter(Boolean).join(',').trim();
      return { id: `${index}-${trimmed}`, username: username || `Participant ${index + 1}`, comment, platform };
    }
    const match = trimmed.match(/^@?([\w. -]{1,40})\s*[:|]\s*(.+)$/);
    return { id: `${index}-${trimmed}`, username: match?.[1]?.trim() || `Participant ${index + 1}`, comment: match?.[2]?.trim() || trimmed, platform };
  }).filter((entry): entry is CommentEntry => Boolean(entry?.comment));
}

function randomIndex(max: number) {
  if (max <= 1) return 0;
  const range = 0x100000000;
  const limit = range - (range % max);
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % max;
}

export function CommentPicker() {
  const [platform, setPlatform] = useState<Platform>('Instagram');
  const [rawComments, setRawComments] = useState('');
  const [keyword, setKeyword] = useState('');
  const [minimumMentions, setMinimumMentions] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(true);
  const [winnerCount, setWinnerCount] = useState(1);
  const [winners, setWinners] = useState<CommentEntry[]>([]);
  const [notice, setNotice] = useState('');

  const imported = useMemo(() => parseComments(rawComments, platform), [rawComments, platform]);
  const eligible = useMemo(() => {
    const filtered = imported.filter((entry) => {
      const mentions = (entry.comment.match(/@[\w.]+/g) || []).length;
      return (!keyword.trim() || entry.comment.toLowerCase().includes(keyword.trim().toLowerCase())) && mentions >= minimumMentions;
    });
    if (!uniqueUsers) return filtered;
    const seen = new Set<string>();
    return filtered.filter((entry) => {
      const key = entry.username.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [imported, keyword, minimumMentions, uniqueUsers]);

  const importFile = async (file?: File) => {
    if (!file) return;
    const content = await file.text();
    setRawComments((current) => [current, content].filter(Boolean).join('\n'));
    setNotice(`${file.name} imported. Review the entries before picking.`);
  };

  const pickWinners = () => {
    if (!eligible.length) { setNotice('Import comments and check your filters first.'); return; }
    const count = Math.max(1, Math.min(Number(winnerCount) || 1, eligible.length));
    const pool = [...eligible];
    const selected: CommentEntry[] = [];
    for (let index = 0; index < count; index += 1) selected.push(pool.splice(randomIndex(pool.length), 1)[0]);
    setWinners(selected);
    setNotice(`${selected.length} winner${selected.length === 1 ? '' : 's'} selected from ${eligible.length} eligible entries.`);
  };

  const exportWinners = () => {
    const csv = ['Platform,Username,Comment', ...winners.map((winner) => [winner.platform, winner.username, winner.comment].map((value) => `\"${value.replace(/"/g, '""')}\"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'activitydesk-comment-winners.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="dashboard-page comment-picker-page">
    <div className="page-heading"><div><span className="section-kicker">CREATOR GIVEAWAYS</span><h1>Comment picker</h1><p>Import comments from your social posts, apply fair-entry filters and select winners.</p></div><span className="comment-picker-mark"><Shuffle size={19} /> Random selection</span></div>
    <div className="comment-platform-grid">{platforms.map((item) => <button key={item} className={`platform-card ${platform === item ? 'selected' : ''}`} onClick={() => { setPlatform(item); setWinners([]); }}><span className="platform-icon">{item === 'Instagram' ? <Instagram /> : item === 'YouTube' ? <Youtube /> : item === 'Facebook' ? 'f' : item === 'X' ? '𝕏' : item === 'TikTok' ? '♪' : '＋'}</span><strong>{item}</strong><small>{item === 'Other' ? 'Any platform' : 'Import comments'}</small></button>)}</div>
    <div className="comment-picker-grid">
      <section className="panel comment-import-panel"><div className="panel-heading"><div><h2>1. Import comments</h2><p>Selected source: {platform}</p></div><ClipboardPaste size={19} /></div>
        <div className="platform-guidance"><ShieldCheck size={17} /><span>Use the platform’s own export or copy/paste comments you’re authorized to access. Direct API imports require separate platform approval and credentials.</span></div>
        <label className="comment-text-label">Paste comments or upload a CSV / TXT file<textarea value={rawComments} onChange={(event) => { setRawComments(event.target.value); setWinners([]); }} placeholder={'@alex: Love this! @sam\n@jordan: Amazing giveaway\n@casey: Count me in!'} rows={12} /></label>
        <div className="comment-import-actions"><label className="button button-secondary file-button"><FileUp size={16} /> Upload CSV / TXT<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => void importFile(event.target.files?.[0])} /></label><button className="button button-secondary" onClick={() => { setRawComments(''); setWinners([]); setNotice('Comments cleared.'); }}><RotateCcw size={15} /> Clear</button></div>
        <div className="comment-counts"><span><strong>{imported.length}</strong> imported</span><span><strong>{eligible.length}</strong> eligible</span><span><strong>{new Set(imported.map((entry) => entry.username.toLowerCase())).size}</strong> unique users</span></div>
      </section>
      <section className="panel comment-filter-panel"><div className="panel-heading"><div><h2>2. Entry rules</h2><p>Control who can win</p></div><Filter size={19} /></div>
        <label className="comment-field">Required keyword (optional)<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="e.g. #ActivityDesk" /></label>
        <label className="comment-field">Minimum @mentions<input type="number" min="0" max="50" value={minimumMentions} onChange={(event) => setMinimumMentions(Math.max(0, Number(event.target.value)))} /></label>
        <label className="comment-toggle"><input type="checkbox" checked={uniqueUsers} onChange={(event) => setUniqueUsers(event.target.checked)} /><span><strong>One entry per username</strong><small>Remove repeat comments from the same account.</small></span><Check size={17} /></label>
        <label className="comment-field">Number of winners<input type="number" min="1" max={Math.max(1, eligible.length)} value={winnerCount} onChange={(event) => setWinnerCount(Math.max(1, Number(event.target.value)))} /></label>
        <button className="button button-primary button-full comment-pick-button" onClick={pickWinners} disabled={!eligible.length}><Shuffle size={17} /> Pick {Math.min(Math.max(1, winnerCount), Math.max(1, eligible.length))} winner{winnerCount === 1 ? '' : 's'}</button>
      </section>
    </div>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {winners.length > 0 && <section className="panel comment-winners-panel"><div className="panel-heading"><div><h2>3. Selected winners</h2><p>Selected locally using the browser’s cryptographic random generator.</p></div><button className="button button-secondary button-small" onClick={exportWinners}><Download size={15} /> Export CSV</button></div><div className="comment-winner-list">{winners.map((winner, index) => <article className="comment-winner" key={winner.id}><span className="comment-winner-number">{index + 1}</span><span className="comment-winner-avatar">{winner.username.slice(0, 1).toUpperCase()}</span><span className="comment-winner-details"><strong>@{winner.username}</strong><small>{winner.comment}</small></span><Trophy size={19} /></article>)}</div></section>}
    <div className="comment-picker-note"><Users size={17} /><p><strong>Platform access note:</strong> This import-based picker works with comment data exported or copied from Instagram, YouTube, Facebook, X, TikTok and other services. Automatic comment fetching is not universally available: each platform has its own API, access scopes, app review and rate limits. The picker does not bypass private-account or platform restrictions.</p></div>
  </div>;
}
