import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { event_id: eventId, display_name: displayName, email } = await req.json();
    if (!eventId || typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.length > 100 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid name and email are required.');
    const client = getAdminClient();
    const { data: event, error } = await client.from('events').select('id,visibility,status,registration_enabled').eq('id', eventId).single();
    if (error || !event || event.status !== 'published' || !event.registration_enabled || event.visibility === 'private') throw new Error('Registration is not available for this event.');
    const { error: insertError } = await client.from('event_participants').insert({ event_id: eventId, display_name: displayName.trim(), email: email.toLowerCase(), status: 'approved' });
    if (insertError?.code === '23505') throw new Error('This email is already registered.');
    if (insertError) throw insertError;
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unexpected error.' }, { status: 400, headers: corsHeaders }); }
});
