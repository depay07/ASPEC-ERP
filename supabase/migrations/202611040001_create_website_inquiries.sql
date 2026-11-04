create table if not exists public.website_inquiries (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    inquiry_type text not null default '간단 문의' check (char_length(inquiry_type) between 1 and 100),
    message text not null check (char_length(message) between 10 and 10000),
    contact text check (contact is null or char_length(contact) <= 200),
    source_page text check (source_page is null or char_length(source_page) <= 500),
    status text not null default 'new' check (status in ('new', 'in_progress', 'completed', 'spam')),
    notification_status text not null default 'pending' check (notification_status in ('pending', 'sent', 'failed', 'not_configured')),
    notification_attempts integer not null default 0 check (notification_attempts >= 0),
    notification_last_error text,
    ip_hash text not null check (char_length(ip_hash) = 64),
    handled_at timestamptz,
    handled_by uuid,
    internal_note text check (internal_note is null or char_length(internal_note) <= 5000)
);

alter table public.website_inquiries enable row level security;

revoke all on table public.website_inquiries from anon;
grant select, update on table public.website_inquiries to authenticated;

create policy "직원_홈페이지문의_조회"
on public.website_inquiries
for select
to authenticated
using ((select auth.uid()) is not null);

create policy "직원_홈페이지문의_처리"
on public.website_inquiries
for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

create index website_inquiries_status_created_idx
on public.website_inquiries (status, created_at desc);

create index website_inquiries_ip_created_idx
on public.website_inquiries (ip_hash, created_at desc);

