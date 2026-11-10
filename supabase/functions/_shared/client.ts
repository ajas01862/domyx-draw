import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing Supabase server environment variables.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getUser(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw new Error('Authentication required.');
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Invalid or expired session.');
  return data.user;
}
