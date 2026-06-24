create table if not exists euchre_games (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active', 'complete', 'abandoned')),
  config jsonb not null,
  target_score integer not null default 10,
  team_zero_score integer not null default 0,
  team_one_score integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists euchre_game_participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references euchre_games(id) on delete cascade,
  user_id uuid,
  display_name text not null,
  seat integer not null check (seat between 0 and 3),
  team integer not null check (team between 0 and 1),
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, seat)
);

create table if not exists euchre_hands (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references euchre_games(id) on delete cascade,
  hand_number integer not null,
  dealer integer not null check (dealer between 0 and 3),
  seed integer not null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (game_id, hand_number)
);

create table if not exists euchre_move_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references euchre_games(id) on delete cascade,
  hand_id uuid references euchre_hands(id) on delete set null,
  sequence_number integer not null,
  player integer check (player between 0 and 3),
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (game_id, sequence_number)
);

create index if not exists euchre_move_events_game_sequence_idx
  on euchre_move_events(game_id, sequence_number);

create index if not exists euchre_hands_game_hand_number_idx
  on euchre_hands(game_id, hand_number);
