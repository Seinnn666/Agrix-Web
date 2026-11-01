-- Apply once to the Supabase project used by the AgriX server.
-- The API accesses this table with the service role and enforces recipient scoping.
begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  "userId" text,
  audience text not null default 'user',
  title text not null,
  message text not null,
  level text not null default 'info',
  read boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications ("userId", "createdAt" desc);
create index if not exists notifications_audience_created_idx
  on public.notifications (audience, "createdAt" desc);

alter table public.notifications enable row level security;

grant select, insert, update, delete on public.notifications to service_role;

-- Make a newly created table visible to the Supabase REST API immediately.
notify pgrst, 'reload schema';

commit;
