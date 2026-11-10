import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getUser } from '../_shared/client.ts';

const hex = (bytes: Uint8Array) => Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const sha256 = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    const body = await req.json();
    const title = String(body.title || '').trim();
    const workspaceId = String(body.workspace_id || '');
    const drawType = String(body.draw_type || 'random');
    const winnerCount = Number(body.winner_count || 1);
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (!title || title.length > 120) throw new Error('A valid draw title is required.');
    if (!['random', 'number', 'wheel', 'comment', 'chitty'].includes(drawType)) throw new Error('Invalid draw type.');
    if (entries.length < 2 || entries.length > 10000) throw new Error('Provide between 2 and 10,000 entries.');
    if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount >= entries.length || winnerCount > 100) throw new Error('Winner count must be between 1 and 100 and lower than participant count.');
    const client = getAdminClient();
    const { data: membership } = await client.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
    if (!membership || !['owner', 'admin', 'organizer'].includes(membership.role)) throw new Error('You do not have permission to create draws in this workspace.');
    const normalized = entries.map((entry: { entry_key?: string; display_name?: string; weight?: number }, index: number) => ({ entry_key: String(entry.entry_key || `entry-${index}`).slice(0, 180), display_name: String(entry.display_name || '').trim().slice(0, 150), weight: Number(entry.weight ?? 1), eligible: true })).filter((entry: { display_name: string; weight: number }) => entry.display_name && Number.isFinite(entry.weight) && entry.weight > 0 && entry.weight <= 1000000);
    if (normalized.length < 2) throw new Error('At least two valid entries are required.');
    if (new Set(normalized.map((entry: { entry_key: string }) => entry.entry_key)).size !== normalized.length) throw new Error('Entry identifiers must be unique.');
    const canonical = JSON.stringify(normalized.map((entry: { entry_key: string; display_name: string; weight: number }) => ({ ...entry, weight: entry.weight.toFixed(4) })));
    const snapshotHash = await sha256(canonical);
    const seed = hex(crypto.getRandomValues(new Uint8Array(32)));
    const commitment = await sha256(seed);
    const { data: draw, error: drawError } = await client.from('draws').insert({ workspace_id: workspaceId, created_by: user.id, title, draw_type: drawType, status: 'ready', winner_count: winnerCount, participant_count: normalized.length, snapshot_hash: snapshotHash, seed_commitment: commitment }).select('id').single();
    if (drawError || !draw) throw drawError || new Error('Could not create draw.');
    const { error: entryError } = await client.from('draw_entries').insert(normalized.map((entry: { entry_key: string; display_name: string; weight: number; eligible: boolean }) => ({ draw_id: draw.id, ...entry })));
    if (entryError) { await client.from('draws').delete().eq('id', draw.id); throw entryError; }
    const { error: secretError } = await client.from('draw_secrets').insert({ draw_id: draw.id, seed });
    if (secretError) { await client.from('draws').delete().eq('id', draw.id); throw secretError; }
    await client.from('draw_audit_logs').insert({ draw_id: draw.id, actor_id: user.id, action: 'draw_created', details: { participant_count: normalized.length, winner_count: winnerCount, snapshot_hash: snapshotHash, seed_commitment: commitment } });
    return Response.json({ draw_id: draw.id, participant_count: normalized.length, snapshot_hash: snapshotHash, seed_commitment: commitment }, { headers: corsHeaders });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unexpected error.' }, { status: 400, headers: corsHeaders }); }
});
