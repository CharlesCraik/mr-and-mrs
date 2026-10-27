-- Private game state. RLS on with NO policies: only the service role (Netlify functions) can touch it.
create table if not exists public.games (
  id uuid primary key,
  room_code text not null unique,
  host_token_hash text not null,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.games enable row level security;
revoke all on public.games from anon, authenticated;

-- Public snapshots: never contain hidden answers, correct answers before reveal, or tokens.
create table if not exists public.public_games (
  id uuid primary key references public.games(id) on delete cascade,
  room_code text not null,
  snapshot jsonb not null,
  rev integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.public_games enable row level security;
revoke insert, update, delete on public.public_games from anon, authenticated;
grant select on public.public_games to anon, authenticated;
create policy "anyone can read snapshots" on public.public_games for select to anon, authenticated using (true);

create index if not exists games_expires_idx on public.games (expires_at);

alter publication supabase_realtime add table public.public_games;
