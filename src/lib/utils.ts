export function initials(name: string | null | undefined) { return (name || 'D').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''); }
export function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not scheduled'; }
export function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48); }
