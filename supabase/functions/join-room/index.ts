import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { room_code: roomCode, display_name: displayName } = await req.json();
    if (typeof roomCode !== 'string' || !/^[A-Z0-9]{6,12}$/.test(roomCode.toUpperCase())) throw new Error('Invalid room code.');
    const client = getAdminClient();
    const { data: room, error } = await client.from('live_rooms').select('id,title,visibility,status').eq('room_code', roomCode.toUpperCase()).single();
    if (error || !room || room.status === 'ended' || room.visibility === 'private') throw new Error('This room is unavailable.');
    const { error: insertError } = await client.from('room_participants').insert({ room_id: room.id, display_name: String(displayName || 'Guest').trim().slice(0, 80), role: 'viewer' });
    if (insertError) throw insertError;
    return Response.json({ room }, { headers: corsHeaders });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unexpected error.' }, { status: 400, headers: corsHeaders }); }
});
