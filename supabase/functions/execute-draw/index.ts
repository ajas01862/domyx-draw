import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getUser } from '../_shared/client.ts';

function createRandomSource(seed: string) {
  const keyPromise = crypto.subtle.importKey('raw', Uint8Array.from(seed.match(/.{2}/g)!.map((part) => parseInt(part, 16))), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  let counter = 0;
  return async (max: number) => {
    if (!Number.isSafeInteger(max) || max < 1 || max > 0xffffffff) throw new Error('Invalid selection range.');
    const range = 0x100000000;
    const limit = Math.floor(range / max) * max;
    while (true) {
      const key = await keyPromise;
      const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(counter++))));
      const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
      const value = view.getUint32(0);
      if (value < limit) return value % max;
    }
  };
}

async function chooseWeighted(entries: { id: string; display_name: string; weight: number }[], count: number, randomInt: (max: number) => Promise<number>) {
  const pool = [...entries]; const selected: typeof entries = [];
  for (let index = 0; index < count; index += 1) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    if (!Number.isFinite(total) || total <= 0 || total > Number.MAX_SAFE_INTEGER) throw new Error('Invalid total participant weight.');
    const target = (await randomInt(0xffffffff)) / 0xffffffff * total;
    let cumulative = 0;
    const chosenIndex = pool.findIndex((entry) => { cumulative += entry.weight; return target < cumulative; });
    selected.push(pool.splice(chosenIndex < 0 ? pool.length - 1 : chosenIndex, 1)[0]);
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
    const { data: draw, error: drawError } = await client.from('draws').select('id,workspace_id,status,winner_count,snapshot_hash,seed_commitment').eq('id', drawId).single();
    if (drawError || !draw) throw new Error('Draw not found.');
    const { data: membership } = await client.from('workspace_members').select('role').eq('workspace_id', draw.workspace_id).eq('user_id', user.id).maybeSingle();
    if (!membership || !['owner', 'admin', 'organizer'].includes(membership.role)) throw new Error('You are not allowed to execute this draw.');
    if (draw.status !== 'ready') throw new Error('Only a ready draw can be executed.');
    const [{ data: entries, error: entriesError }, { data: secret, error: secretError }] = await Promise.all([client.from('draw_entries').select('id,display_name,weight').eq('draw_id', drawId).eq('eligible', true), client.from('draw_secrets').select('seed').eq('draw_id', drawId).single()]);
    if (entriesError || secretError || !entries || !secret) throw new Error('Draw snapshot or secret is unavailable.');
    if (entries.length < 2 || draw.winner_count >= entries.length) throw new Error('The draw does not have enough eligible entries.');
    const randomInt = createRandomSource(secret.seed);
    const selected = await chooseWeighted(entries.map((entry) => ({ ...entry, weight: Number(entry.weight) })), draw.winner_count, randomInt);
    const { error: completeError } = await client.rpc('complete_draw_transaction', { p_draw_id: drawId, p_entry_ids: selected.map((entry) => entry.id), p_seed_reveal: secret.seed, p_actor_id: user.id });
    if (completeError) throw completeError;
    return Response.json({ draw_id: drawId, winners: selected.map((entry) => ({ display_name: entry.display_name })), seed_commitment: draw.seed_commitment, seed_reveal: secret.seed, snapshot_hash: draw.snapshot_hash }, { headers: corsHeaders });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unexpected error.' }, { status: 400, headers: corsHeaders }); }
});
