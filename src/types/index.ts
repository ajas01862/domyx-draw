export type Profile = { id: string; username: string | null; full_name: string | null; avatar_url: string | null; is_admin?: boolean };
export type EventRecord = { id: string; title: string; slug: string; description: string | null; status: string; visibility: string; starts_at: string | null; created_at: string };
export type DrawRecord = { id: string; title: string; draw_type: string; status: string; participant_count: number; winner_count: number; created_at: string };
