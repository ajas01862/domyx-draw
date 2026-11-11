import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getUser } from '../_shared/client.ts';

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const sha256 = async (value: string) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

function createRandomSource(seed: string) {
  const seedBytes = Uint8Array.from(seed.match(/.{2}/g) || [], (part) => Number.parseInt(part, 16));
  if (seedBytes.length !== 32) throw new Error('The revealed seed is invalid.');
  const keyPromise = crypto.subtle.importKey('raw', seedBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  let counter = 0;

  return async (max: number) => {
    const key = await keyPromise;
    const range = 0x100000000;
    const limit = Math.floor(range / max) * max;
    while (true) {
      const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(counter++))));
      const value = new DataView(digest.buffer, digest.byteOffset, digest.byteLength).getUint32(0);
      if (value < limit) return value % max;
    }
  };
}

async function replaySelection(entries: { id: string; weight: number }[], count: number, seed: string) {
  const randomInt = createRandomSource(seed);
  const pool = [...entries];
  const selected: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (!Number.isFinite(total) || total <= 0 || total > Number.MAX_SAFE_INTEGER) throw new Error('Participant weights are invalid.');
    const target = (await randomInt(0xffffffff)) / 0xffffffff * total;
    let cumulative = 0;
    const selectedIndex = pool.findIndex((entry) => {
      cumulative += entry.weight;
      return target < cumulative;
    });
    const [winner] = pool.splice(selectedIndex < 0 ? pool.length - 1 : selectedIndex, 1);
    selected.push(winner.id);
  }

  return selected;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    const { draw_id: drawId } = await req.json();
    if (!drawId) throw new Error('draw_id is required.');

    const client = getAdminClient();
    const { data: draw, error } = await client.from('draws').select('id,title,status,workspace_id,participant_count,winner_count,snapshot_hash,seed_commitment,seed_reveal,created_at,completed_at').eq('id', drawId).eq('status', 'completed').single();
    if (error || !draw) throw new Error('Completed draw not found.');

    const { data: membership } = await client.from('workspace_members').select('role').eq('workspace_id', draw.workspace_id).eq('user_id', user.id).maybeSingle();
    if (!membership) throw new Error('You are not allowed to verify this private draw.');
    if (!draw.seed_reveal) throw new Error('The revealed seed is missing.');

    const [{ data: entries, error: entriesError }, { data: winners, error: winnersError }] = await Promise.all([
      client.from('draw_entries').select('id,entry_key,display_name,weight,eligible').eq('draw_id', drawId),
      client.from('draw_winners').select('position,entry_id').eq('draw_id', drawId).order('position'),
    ]);
    if (entriesError || winnersError || !entries || !winners) throw new Error('Draw verification data could not be loaded.');

    const orderedEntries = [...entries].sort((a, b) => {
      const aIndex = Number.parseInt(a.entry_key, 10);
      const bIndex = Number.parseInt(b.entry_key, 10);
      if (Number.isFinite(aIndex) && Number.isFinite(bIndex) && aIndex !== bIndex) return aIndex - bIndex;
      return a.entry_key.localeCompare(b.entry_key);
    });
    const canonical = JSON.stringify(orderedEntries.map((entry) => ({
      entry_key: entry.entry_key,
      display_name: entry.display_name,
      weight: Number(entry.weight).toFixed(4),
      eligible: entry.eligible,
    })));
    const [seedHash, snapshotHash] = await Promise.all([sha256(draw.seed_reveal), sha256(canonical)]);
    const eligibleEntries = orderedEntries.filter((entry) => entry.eligible).map((entry) => ({ id: entry.id, weight: Number(entry.weight) }));
    const replayedWinnerIds = await replaySelection(eligibleEntries, draw.winner_count, draw.seed_reveal);
    const actualWinnerIds = [...winners].sort((a, b) => a.position - b.position).map((winner) => winner.entry_id);

    return Response.json({
      draw,
      winners,
      checks: {
        seed_commitment_matches: seedHash === draw.seed_commitment,
        snapshot_hash_matches: snapshotHash === draw.snapshot_hash,
        participant_count_matches: entries.length === draw.participant_count,
        winner_selection_matches: JSON.stringify(replayedWinnerIds) === JSON.stringify(actualWinnerIds),
        expected_winner_count: draw.winner_count,
        actual_winner_count: winners.length,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    console.error('verify-draw failed:', message, error);
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }
});
