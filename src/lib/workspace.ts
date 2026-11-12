import { supabase } from './supabase';

export async function getCurrentWorkspaceId(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id,role,joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  if (!data?.length) throw new Error('No workspace is linked to this account.');

  const preferred = data.find((membership) => membership.role !== 'viewer') || data[0];
  return preferred.workspace_id;
}
