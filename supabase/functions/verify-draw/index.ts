import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient, getUser } from '../_shared/client.ts';

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
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(draw.seed_reveal || '')));
    const seedHash = Array.from(digest).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const [{ data: entries }, { data: winners }] = await Promise.all([client.from('draw_entries').select('entry_key,display_name,weight,eligible').eq('draw_id', drawId).order('entry_key'), client.from('draw_winners').select('position,entry_id,draw_entries(display_name)').eq('draw_id', drawId).order('position')]);
    return Response.json({ draw, entries, winners, checks: { seed_commitment_matches: seedHash === draw.seed_commitment, snapshot_hash: draw.snapshot_hash, note: 'This endpoint checks the revealed seed against its commitment. Independent replay verification of the weighted selection is a separate planned verifier.' } }, { headers: corsHeaders });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unexpected error.' }, { status: 400, headers: corsHeaders }); }
});
