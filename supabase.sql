create table if not exists camp_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table camp_state enable row level security;

insert into camp_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;
