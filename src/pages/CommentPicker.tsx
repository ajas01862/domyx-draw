import { useMemo, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  Download,
  FileUp,
  Filter,
  Instagram,
  Link2,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Trophy,
  Users,
  Youtube,
} from 'lucide-react';

type Platform = 'Instagram' | 'YouTube' | 'Facebook' | 'X' | 'TikTok' | 'Other';
type MatchMode = 'contains' | 'does-not-contain' | 'exact';
type EntryMode = 'one-per-user' | 'every-comment';
type CommentEntry = {
  id: string;
  username: string;
  comment: string;
  platform: Platform;
  isReply: boolean;
  sourceUrl: string;
  date: string;
};

const platforms: Platform[] = ['Instagram', 'YouTube', 'Facebook', 'X', 'TikTok', 'Other'];

const csvParse = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"' && quoted && input[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

const normalizeHeader = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

function parseComments(value: string, platform: Platform, sourceUrl: string): CommentEntry[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      return records.flatMap((record, index) => {
        if (!record || typeof record !== 'object') return [];
        const item = record as Record<string, unknown>;
        const username = String(item.username ?? item.author ?? item.user ?? item.handle ?? '').trim();
        const comment = String(item.comment ?? item.text ?? item.message ?? '').trim();
        if (!comment) return [];
        return [{
          id: `json-${index}-${username}`,
          username: username.replace(/^@/, '') || `Participant ${index + 1}`,
          comment,
          platform,
          isReply: Boolean(item.isReply ?? item.is_reply ?? item.reply),
          sourceUrl: String(item.url ?? item.sourceUrl ?? sourceUrl),
          date: String(item.date ?? item.publishedAt ?? ''),
        }];
      });
    } catch {
      // Fall through to CSV and plain-text parsing.
    }
  }

  const rows = csvParse(trimmed);
  const firstRow = rows[0]?.map(normalizeHeader) ?? [];
  const usernameIndex = firstRow.findIndex((value) =>
    ['username', 'user', 'handle', 'author', 'authorname', 'displayname'].includes(value),
  );
  const commentIndex = firstRow.findIndex((value) =>
    ['comment', 'text', 'message', 'content', 'commenttext'].includes(value),
  );

  if (usernameIndex >= 0 && commentIndex >= 0) {
    return rows.slice(1).flatMap((row, index) => {
      const comment = (row[commentIndex] ?? '').trim();
      if (!comment) return [];
      return [{
        id: `csv-${index}-${row[usernameIndex] ?? ''}`,
        username: (row[usernameIndex] ?? '').trim().replace(/^@/, '') || `Participant ${index + 1}`,
        comment,
        platform,
        isReply: /^(true|1|yes)$/i.test(row[firstRow.findIndex((value) => ['isreply', 'reply'].includes(value))] ?? ''),
        sourceUrl: row[firstRow.findIndex((value) => ['url', 'permalink', 'sourceurl'].includes(value))] || sourceUrl,
        date: row[firstRow.findIndex((value) => ['date', 'createdat', 'publishedat', 'timestamp'].includes(value))] ?? '',
      }];
    });
  }

  return trimmed.split(/\r?\n/).flatMap((line, index) => {
    const current = line.trim();
    if (!current) return [];
    const tabParts = current.split(/\t+/);
    const match = current.match(/^@?([\w.-]{1,60})\s*(?::|\||\s-\s)\s*(.+)$/);
    const username = tabParts.length > 1
      ? tabParts[0].trim().replace(/^@/, '')
      : match?.[1]?.trim().replace(/^@/, '') || `Participant ${index + 1}`;
    const comment = tabParts.length > 1 ? tabParts.slice(1).join(' ').trim() : match?.[2]?.trim() || current;

    return [{
      id: `line-${index}-${username}`,
      username,
      comment,
      platform,
      isReply: false,
      sourceUrl,
      date: '',
    }];
  });
}

function randomIndex(max: number) {
  if (max <= 1) return 0;
  const range = 0x100000000;
  const limit = range - (range % max);
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % max;
}

function isSafeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function downloadCsv(entries: CommentEntry[], filename: string) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = [
    ['Platform', 'Username', 'Comment', 'Source URL', 'Date'].map(escape).join(','),
    ...entries.map((entry) =>
      [entry.platform, entry.username, entry.comment, entry.sourceUrl, entry.date].map(escape).join(','),
    ),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CommentPicker() {
  const [platform, setPlatform] = useState<Platform>('Instagram');
  const [sourceUrl, setSourceUrl] = useState('');
  const [profileName, setProfileName] = useState('');
  const [rawComments, setRawComments] = useState('');
  const [includeText, setIncludeText] = useState('');
  const [excludeText, setExcludeText] = useState('');
  const [matchMode, setMatchMode] = useState<MatchMode>('contains');
  const [matchAllTerms, setMatchAllTerms] = useState(false);
  const [minimumMentions, setMinimumMentions] = useState(0);
  const [minimumLength, setMinimumLength] = useState(0);
  const [entryMode, setEntryMode] = useState<EntryMode>('one-per-user');
  const [includeReplies, setIncludeReplies] = useState(true);
  const [winnerCount, setWinnerCount] = useState(1);
  const [winners, setWinners] = useState<CommentEntry[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const imported = useMemo(
    () => parseComments(rawComments, platform, sourceUrl.trim()),
    [rawComments, platform, sourceUrl],
  );

  const eligible = useMemo(() => {
    const includeTerms = includeText.split(',').map((term) => term.trim().toLowerCase()).filter(Boolean);
    const excludeTerms = excludeText.split(',').map((term) => term.trim().toLowerCase()).filter(Boolean);

    return imported.filter((entry) => {
      const comment = entry.comment.toLowerCase();
      const termMatches = includeTerms.map((term) => matchMode === 'exact' ? comment === term : comment.includes(term));
      const matchesInclude = !includeTerms.length || (matchMode === 'does-not-contain'
        ? termMatches.every((matches) => !matches)
        : matchAllTerms ? termMatches.every(Boolean) : termMatches.some(Boolean));
      const matchesExclude = excludeTerms.some((term) => comment.includes(term));
      const mentions = (entry.comment.match(/@[a-z0-9_.]+/gi) ?? []).length;

      return matchesInclude
        && !matchesExclude
        && mentions >= minimumMentions
        && entry.comment.length >= minimumLength
        && (includeReplies || !entry.isReply);
    }).filter((entry, index, entries) => {
      if (entryMode === 'every-comment') return true;
      return entries.findIndex((candidate) => candidate.username.toLowerCase() === entry.username.toLowerCase()) === index;
    });
  }, [imported, includeText, excludeText, matchMode, matchAllTerms, minimumMentions, minimumLength, includeReplies, entryMode]);

  const importFile = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const content = await file.text();
      setRawComments(content);
      setWinners([]);
      setNotice(`${file.name} imported. Check the detected comment count and filters.`);
    } catch {
      setError('This file could not be read. Try a UTF-8 CSV, JSON or TXT file.');
    }
  };

  const pickWinners = () => {
    setError('');
    if (!eligible.length) {
      setNotice('');
      setError('No eligible comments. Check your import and entry filters.');
      return;
    }

    const count = Math.max(1, Math.min(Number(winnerCount) || 1, eligible.length));
    const pool = [...eligible];
    const selected: CommentEntry[] = [];

    for (let index = 0; index < count; index += 1) {
      selected.push(pool.splice(randomIndex(pool.length), 1)[0]);
    }

    setWinners(selected);
    setNotice(`${selected.length} winner${selected.length === 1 ? '' : 's'} selected from ${eligible.length} eligible entries.`);
  };

  const resetFilters = () => {
    setIncludeText('');
    setExcludeText('');
    setMatchMode('contains');
    setMatchAllTerms(false);
    setMinimumMentions(0);
    setMinimumLength(0);
    setEntryMode('one-per-user');
    setIncludeReplies(true);
    setWinnerCount(1);
    setWinners([]);
    setError('');
    setNotice('Entry rules reset.');
  };

  return (
    <div className="dashboard-page comment-picker-page">
      <div className="page-heading">
        <div>
          <span className="section-kicker">CREATOR GIVEAWAYS</span>
          <h1>Comment picker</h1>
          <p>Import, filter and randomly select winners from social media comments.</p>
        </div>
        <span className="comment-picker-mark"><Shuffle size={19} /> Fair random draw</span>
      </div>

      <div className="comment-platform-grid">
        {platforms.map((item) => (
          <button
            key={item}
            className={`platform-card ${platform === item ? 'selected' : ''}`}
            onClick={() => {
              setPlatform(item);
              setWinners([]);
            }}
            type="button"
          >
            <span className="platform-icon">
              {item === 'Instagram' ? <Instagram /> : item === 'YouTube' ? <Youtube /> : item === 'Facebook' ? 'f' : item === 'X' ? '𝕏' : item === 'TikTok' ? '♪' : '＋'}
            </span>
            <strong>{item}</strong>
            <small>{item === 'Other' ? 'CSV, JSON or text' : 'Import or reference'}</small>
          </button>
        ))}
      </div>

      <div className="comment-picker-grid">
        <section className="panel comment-import-panel">
          <div className="panel-heading">
            <div><h2>1. Select your post</h2><p>Record the public post or creator profile being used.</p></div>
            <Link2 size={19} />
          </div>
          <label className="comment-field">
            Post / video URL (optional)
            <input value={sourceUrl} onChange={(event) => { setSourceUrl(event.target.value); setWinners([]); }} placeholder="https://www.youtube.com/watch?v=..." />
          </label>
          <label className="comment-field">
            Creator / profile name (optional)
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="@creatorname or channel name" />
          </label>
          <div className="platform-guidance">
            <ShieldCheck size={17} />
            <span>URL and profile fields label your giveaway source; they do not fetch comments by themselves. Automatic retrieval requires an approved provider API connection. Never enter a social-media password or session cookie here.</span>
          </div>

          <div className="panel-heading">
            <div><h2>2. Import comments</h2><p>Paste comments or import a structured file.</p></div>
            <ClipboardPaste size={19} />
          </div>
          <label className="comment-text-label">
            Comments
            <textarea
              value={rawComments}
              onChange={(event) => { setRawComments(event.target.value); setWinners([]); setError(''); }}
              placeholder={'One comment per line:\n@alex: Love this!\n@sam: Count me in!\n\nCSV: username,comment,isReply,date'}
              rows={10}
            />
          </label>
          <div className="comment-import-actions">
            <label className="button button-secondary file-button">
              <FileUp size={16} /> Upload CSV / JSON / TXT
              <input
                type="file"
                accept=".csv,.tsv,.txt,.json,text/csv,text/plain,application/json"
                onChange={(event) => {
                  void importFile(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <button className="button button-secondary" type="button" onClick={() => {
              setRawComments('');
              setWinners([]);
              setNotice('Imported comments cleared.');
              setError('');
            }}>
              <RotateCcw size={15} /> Clear import
            </button>
          </div>
          <div className="comment-counts">
            <span><strong>{imported.length}</strong> imported</span>
            <span><strong>{eligible.length}</strong> eligible</span>
            <span><strong>{new Set(imported.map((entry) => entry.username.toLowerCase())).size}</strong> accounts</span>
          </div>
        </section>

        <section className="panel comment-filter-panel">
          <div className="panel-heading">
            <div><h2>3. Configure entry rules</h2><p>Decide which comments qualify.</p></div>
            <Filter size={19} />
          </div>
          <label className="comment-field">
            Include comments containing (comma-separated)
            <input value={includeText} onChange={(event) => { setIncludeText(event.target.value); setWinners([]); }} placeholder="giveaway, #activitydesk" />
          </label>
          <label className="comment-field">
            Include matching mode
            <select value={matchMode} onChange={(event) => setMatchMode(event.target.value as MatchMode)}>
              <option value="contains">Contains phrase</option>
              <option value="exact">Exact comment match</option>
              <option value="does-not-contain">Does not contain (use as exclusion)</option>
            </select>
          </label>
          <label className="comment-toggle">
            <input type="checkbox" checked={matchAllTerms} onChange={(event) => setMatchAllTerms(event.target.checked)} />
            <span><strong>Require all included phrases</strong><small>Off means any one phrase can match.</small></span><Check size={17} />
          </label>
          <label className="comment-field">
            Exclude comments containing
            <input value={excludeText} onChange={(event) => setExcludeText(event.target.value)} placeholder="spam, test, not participating" />
          </label>
          <label className="comment-field">
            Minimum @mentions
            <input type="number" min="0" max="50" value={minimumMentions} onChange={(event) => setMinimumMentions(Math.max(0, Number(event.target.value)))} />
          </label>
          <label className="comment-field">
            Minimum comment length
            <input type="number" min="0" max="5000" value={minimumLength} onChange={(event) => setMinimumLength(Math.max(0, Number(event.target.value)))} />
          </label>
          <label className="comment-toggle">
            <input type="checkbox" checked={includeReplies} onChange={(event) => setIncludeReplies(event.target.checked)} />
            <span><strong>Include replies</strong><small>Only applies when your imported file marks replies.</small></span><Check size={17} />
          </label>
          <label className="comment-field">
            Entry weighting
            <select value={entryMode} onChange={(event) => { setEntryMode(event.target.value as EntryMode); setWinners([]); }}>
              <option value="one-per-user">One entry per account</option>
              <option value="every-comment">Every qualifying comment counts</option>
            </select>
          </label>
          <label className="comment-field">
            Number of winners
            <input type="number" min="1" max={Math.max(1, eligible.length)} value={winnerCount} onChange={(event) => setWinnerCount(Math.max(1, Number(event.target.value)))} />
          </label>
          <div className="comment-import-actions">
            <button className="button button-secondary" type="button" onClick={resetFilters}>Reset rules</button>
            <button className="button button-primary comment-pick-button" type="button" onClick={pickWinners} disabled={!eligible.length}>
              <Shuffle size={17} /> Pick {Math.min(Math.max(1, winnerCount), Math.max(1, eligible.length))} winner{winnerCount === 1 ? '' : 's'}
            </button>
          </div>
        </section>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {imported.length > 0 && (
        <section className="panel comment-winners-panel">
          <div className="panel-heading">
            <div><h2>Comment review</h2><p>Showing up to five imported comments. The eligible count reflects your current rules.</p></div>
            <span className="comment-picker-mark">{eligible.length} eligible</span>
          </div>
          <div className="comment-winner-list">
            {imported.slice(0, 5).map((entry) => (
              <article className="comment-winner" key={entry.id}>
                <span className="comment-winner-avatar">{entry.username.slice(0, 1).toUpperCase()}</span>
                <span className="comment-winner-details">
                  <strong>@{entry.username}{entry.isReply ? ' · Reply' : ''}</strong>
                  <small>{entry.comment}</small>
                </span>
                {eligible.some((candidate) => candidate.id === entry.id) ? <Check size={17} /> : <Filter size={17} />}
              </article>
            ))}
          </div>
          {imported.length > 5 && <p className="comment-review-more">And {imported.length - 5} more imported comments.</p>}
        </section>
      )}

      {winners.length > 0 && (
        <section className="panel comment-winners-panel">
          <div className="panel-heading">
            <div><h2>Selected winners</h2><p>{platform} · {eligible.length} eligible entries · selected using Web Crypto.</p></div>
            <div className="comment-import-actions">
              <button className="button button-secondary button-small" type="button" onClick={() => downloadCsv(winners, 'activitydesk-comment-winners.csv')}><Download size={15} /> Export CSV</button>
              <button className="button button-secondary button-small" type="button" onClick={pickWinners}><Shuffle size={15} /> Draw again</button>
            </div>
          </div>
          <div className="comment-winner-list">
            {winners.map((winner, index) => (
              <article className="comment-winner" key={winner.id}>
                <span className="comment-winner-number">{index + 1}</span>
                <span className="comment-winner-avatar">{winner.username.slice(0, 1).toUpperCase()}</span>
                <span className="comment-winner-details">
                  <strong>@{winner.username}</strong>
                  <small>{winner.comment}</small>
                </span>
                <Trophy size={19} />
              </article>
            ))}
          </div>
          <div className="comment-picker-note">
            <Users size={17} />
            <p><strong>Source:</strong> {profileName || 'Creator not specified'}{isSafeHttpUrl(sourceUrl) ? <> · <a href={sourceUrl} target="_blank" rel="noreferrer">Open post</a></> : ''}. Winners are selected locally from the imported data. Save the original export and filters if you need an audit trail.</p>
          </div>
        </section>
      )}

      <div className="comment-picker-note">
        <Users size={17} />
        <p><strong>Platform integration:</strong> This picker accepts exported or copied comments from Instagram, YouTube, Facebook, X, TikTok and other services. A profile name or post URL alone cannot retrieve comments. YouTube, Meta, X and TikTok each have separate API access rules, credentials and approval requirements. API fetching is not enabled in this build; the picker will never ask for account passwords or scrape private content.</p>
      </div>
    </div>
  );
}
