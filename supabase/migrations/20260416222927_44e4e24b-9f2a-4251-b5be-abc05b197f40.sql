create table if not exists public.welcome_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  category text not null check (category in ('question','feedback','feature','partnership')),
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.welcome_messages enable row level security;
create policy "Anyone can submit a welcome message"
  on public.welcome_messages for insert
  to anon, authenticated
  with check (
    length(name) between 1 and 100
    and length(email) between 3 and 320
    and length(message) between 1 and 2000
  );