-- Campeonato 1v1 — schema relacional
-- Tabelas: elenco, fotos, partidas, placares, K/D e histórico de semanas.

create table if not exists public.tournaments (
  id text primary key,
  title text not null,
  week int not null default 1,
  week_label text not null default 'Semana 1',
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id text primary key,
  name text not null,
  color text not null default '#3ec7ff',
  photo_url text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  stage text not null check (stage in ('league', 'playoff')),
  round int,
  match_no int,
  name text,
  subtitle text,
  best_of int not null default 3,
  player1_id text references public.players(id) on delete set null,
  player2_id text references public.players(id) on delete set null,
  bye_id text references public.players(id) on delete set null,
  source_a jsonb,
  source_b jsonb,
  maps_p1 int,
  maps_p2 int,
  kills_p1 int,
  deaths_p1 int,
  kills_p2 int,
  deaths_p2 int,
  updated_at timestamptz not null default now()
);

create table if not exists public.weeks (
  id bigint generated always as identity primary key,
  week int not null unique,
  label text not null,
  champion_id text references public.players(id) on delete set null,
  runner_up_id text references public.players(id) on delete set null,
  last_id text references public.players(id) on delete set null,
  finish jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  closed_at timestamptz not null default now()
);

create table if not exists public.week_player_stats (
  week_id bigint not null references public.weeks(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  wins int not null default 0,
  losses int not null default 0,
  kills int not null default 0,
  deaths int not null default 0,
  primary key (week_id, player_id)
);

create table if not exists public.camp_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists matches_stage_idx on public.matches (stage, round, match_no);
create index if not exists week_stats_player_idx on public.week_player_stats (player_id);

alter table public.tournaments enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.weeks enable row level security;
alter table public.week_player_stats enable row level security;
alter table public.camp_state enable row level security;

insert into public.tournaments (id, title, week, week_label)
values ('main', 'CAMPEONATO 1v1 — ETERNAL PRATAS (CLOSED)', 1, 'Semana 1')
on conflict (id) do nothing;

insert into public.players (id, name, color, sort_order) values
  ('s4mlz', 's4mlz', '#3ec7ff', 1),
  ('fury', 'fury', '#4f7dff', 2),
  ('bill', 'bill', '#7b8cff', 3),
  ('khastz', 'khastz', '#2a6dff', 4),
  ('cadu', 'cadu', '#5ad0ff', 5)
on conflict (id) do nothing;

insert into public.matches (
  id, stage, round, match_no, best_of, player1_id, player2_id, bye_id
) values
  ('g1',  'league', 1, 1,  3, 's4mlz', 'fury',   'cadu'),
  ('g2',  'league', 1, 2,  3, 'bill',  'khastz', 'cadu'),
  ('g3',  'league', 2, 3,  3, 's4mlz', 'bill',   'khastz'),
  ('g4',  'league', 2, 4,  3, 'fury',  'cadu',   'khastz'),
  ('g5',  'league', 3, 5,  3, 's4mlz', 'khastz', 'fury'),
  ('g6',  'league', 3, 6,  3, 'bill',  'cadu',   'fury'),
  ('g7',  'league', 4, 7,  3, 's4mlz', 'cadu',   'bill'),
  ('g8',  'league', 4, 8,  3, 'fury',  'khastz', 'bill'),
  ('g9',  'league', 5, 9,  3, 'fury',  'bill',   's4mlz'),
  ('g10', 'league', 5, 10, 3, 'khastz','cadu',   's4mlz')
on conflict (id) do nothing;

insert into public.matches (
  id, stage, match_no, name, subtitle, best_of, source_a, source_b
) values
  ('sf1',  'playoff', 1, 'Semifinal 1',  '1º × 4º',                 3, '{"type":"seed","n":1}'::jsonb, '{"type":"seed","n":4}'::jsonb),
  ('sf2',  'playoff', 2, 'Semifinal 2',  '2º × 3º',                 3, '{"type":"seed","n":2}'::jsonb, '{"type":"seed","n":3}'::jsonb),
  ('uf',   'playoff', 3, 'Final Upper',  'vencedores',              3, '{"type":"winner","of":"sf1"}'::jsonb, '{"type":"winner","of":"sf2"}'::jsonb),
  ('rep1', 'playoff', 4, 'Lower 1',      'perdedores das semis',    3, '{"type":"loser","of":"sf1"}'::jsonb, '{"type":"loser","of":"sf2"}'::jsonb),
  ('rf',   'playoff', 5, 'Final Lower',  'lower × perdedor upper',  3, '{"type":"winner","of":"rep1"}'::jsonb, '{"type":"loser","of":"uf"}'::jsonb),
  ('gf',   'playoff', 6, 'Grande Final', 'MD5',                     5, '{"type":"winner","of":"uf"}'::jsonb, '{"type":"winner","of":"rf"}'::jsonb)
on conflict (id) do nothing;

insert into public.camp_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

create or replace function public.parse_score(v jsonb)
returns int
language sql
immutable
as $$
  select case
    when v is null or v = 'null'::jsonb then null
    when jsonb_typeof(v) = 'number' then trunc((v #>> '{}')::numeric)::int
    when btrim(coalesce(v #>> '{}', '')) = '' then null
    when (v #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then trunc((v #>> '{}')::numeric)::int
    else null
  end;
$$;

create or replace function public.score_text(v int)
returns text
language sql
immutable
as $$
  select coalesce(v::text, '');
$$;

create or replace function public.load_camp_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tournaments%rowtype;
begin
  select * into t from public.tournaments where id = 'main';
  if not found then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'title', t.title,
    'week', t.week,
    'weekLabel', t.week_label,
    'updatedAt', t.updated_at,
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'color', p.color,
          'photo', p.photo_url
        ) order by p.sort_order, p.name
      )
      from public.players p
    ), '[]'::jsonb),
    'league', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'round', m.round,
          'no', m.match_no,
          'p1', m.player1_id,
          'p2', m.player2_id,
          'bye', m.bye_id,
          'bestOf', m.best_of,
          'w1', public.score_text(m.maps_p1),
          'w2', public.score_text(m.maps_p2),
          'k1', public.score_text(m.kills_p1),
          'd1', public.score_text(m.deaths_p1),
          'k2', public.score_text(m.kills_p2),
          'd2', public.score_text(m.deaths_p2)
        ) order by m.match_no
      )
      from public.matches m
      where m.stage = 'league'
    ), '[]'::jsonb),
    'playoffs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'name', m.name,
          'sub', m.subtitle,
          'bestOf', m.best_of,
          'sourceA', m.source_a,
          'sourceB', m.source_b,
          'w1', public.score_text(m.maps_p1),
          'w2', public.score_text(m.maps_p2),
          'k1', public.score_text(m.kills_p1),
          'd1', public.score_text(m.deaths_p1),
          'k2', public.score_text(m.kills_p2),
          'd2', public.score_text(m.deaths_p2)
        ) order by m.match_no nulls last, m.id
      )
      from public.matches m
      where m.stage = 'playoff'
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'week', w.week,
          'label', w.label,
          'champion', w.champion_id,
          'runnerUp', w.runner_up_id,
          'last', w.last_id,
          'finish', w.finish,
          'stats', w.stats,
          'date', w.closed_at
        ) order by w.week
      )
      from public.weeks w
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_camp_state(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  m jsonb;
  h jsonb;
  sort_i int := 0;
  week_row public.weeks%rowtype;
  stat_key text;
  stat_val jsonb;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload inválido';
  end if;

  insert into public.tournaments (id, title, week, week_label, updated_at)
  values (
    'main',
    coalesce(payload->>'title', 'CAMPEONATO 1v1 — ETERNAL PRATAS (CLOSED)'),
    coalesce(nullif(payload->>'week', '')::int, 1),
    coalesce(payload->>'weekLabel', 'Semana 1'),
    now()
  )
  on conflict (id) do update set
    title = excluded.title,
    week = excluded.week,
    week_label = excluded.week_label,
    updated_at = now();

  for p in select value from jsonb_array_elements(coalesce(payload->'players', '[]'::jsonb))
  loop
    sort_i := sort_i + 1;
    insert into public.players (id, name, color, photo_url, sort_order, updated_at)
    values (
      p->>'id',
      coalesce(nullif(p->>'name', ''), p->>'id'),
      coalesce(nullif(p->>'color', ''), '#3ec7ff'),
      coalesce(p->>'photo', ''),
      sort_i,
      now()
    )
    on conflict (id) do update set
      name = excluded.name,
      color = excluded.color,
      photo_url = excluded.photo_url,
      sort_order = excluded.sort_order,
      updated_at = now();
  end loop;

  for m in select value from jsonb_array_elements(coalesce(payload->'league', '[]'::jsonb))
  loop
    insert into public.matches (
      id, stage, round, match_no, best_of, player1_id, player2_id, bye_id,
      maps_p1, maps_p2, kills_p1, deaths_p1, kills_p2, deaths_p2, updated_at
    )
    values (
      m->>'id',
      'league',
      public.parse_score(m->'round'),
      public.parse_score(m->'no'),
      coalesce(public.parse_score(m->'bestOf'), 3),
      nullif(m->>'p1', ''),
      nullif(m->>'p2', ''),
      nullif(m->>'bye', ''),
      public.parse_score(m->'w1'),
      public.parse_score(m->'w2'),
      public.parse_score(m->'k1'),
      public.parse_score(m->'d1'),
      public.parse_score(m->'k2'),
      public.parse_score(m->'d2'),
      now()
    )
    on conflict (id) do update set
      stage = 'league',
      round = excluded.round,
      match_no = excluded.match_no,
      best_of = excluded.best_of,
      player1_id = excluded.player1_id,
      player2_id = excluded.player2_id,
      bye_id = excluded.bye_id,
      maps_p1 = excluded.maps_p1,
      maps_p2 = excluded.maps_p2,
      kills_p1 = excluded.kills_p1,
      deaths_p1 = excluded.deaths_p1,
      kills_p2 = excluded.kills_p2,
      deaths_p2 = excluded.deaths_p2,
      updated_at = now();
  end loop;

  for m in select value from jsonb_array_elements(coalesce(payload->'playoffs', '[]'::jsonb))
  loop
    insert into public.matches (
      id, stage, name, subtitle, best_of, source_a, source_b,
      maps_p1, maps_p2, kills_p1, deaths_p1, kills_p2, deaths_p2, updated_at
    )
    values (
      m->>'id',
      'playoff',
      m->>'name',
      m->>'sub',
      coalesce(public.parse_score(m->'bestOf'), 3),
      m->'sourceA',
      m->'sourceB',
      public.parse_score(m->'w1'),
      public.parse_score(m->'w2'),
      public.parse_score(m->'k1'),
      public.parse_score(m->'d1'),
      public.parse_score(m->'k2'),
      public.parse_score(m->'d2'),
      now()
    )
    on conflict (id) do update set
      stage = 'playoff',
      name = excluded.name,
      subtitle = excluded.subtitle,
      best_of = excluded.best_of,
      source_a = excluded.source_a,
      source_b = excluded.source_b,
      maps_p1 = excluded.maps_p1,
      maps_p2 = excluded.maps_p2,
      kills_p1 = excluded.kills_p1,
      deaths_p1 = excluded.deaths_p1,
      kills_p2 = excluded.kills_p2,
      deaths_p2 = excluded.deaths_p2,
      updated_at = now();
  end loop;

  delete from public.weeks w
  where not exists (
    select 1
    from jsonb_array_elements(coalesce(payload->'history', '[]'::jsonb)) h2
    where public.parse_score(h2->'week') = w.week
  );

  for h in select value from jsonb_array_elements(coalesce(payload->'history', '[]'::jsonb))
  loop
    insert into public.weeks (
      week, label, champion_id, runner_up_id, last_id, finish, stats, closed_at
    )
    values (
      public.parse_score(h->'week'),
      coalesce(h->>'label', 'Semana'),
      nullif(h->>'champion', ''),
      nullif(h->>'runnerUp', ''),
      nullif(h->>'last', ''),
      coalesce(h->'finish', '{}'::jsonb),
      coalesce(h->'stats', '{}'::jsonb),
      coalesce(nullif(h->>'date', '')::timestamptz, now())
    )
    on conflict (week) do update set
      label = excluded.label,
      champion_id = excluded.champion_id,
      runner_up_id = excluded.runner_up_id,
      last_id = excluded.last_id,
      finish = excluded.finish,
      stats = excluded.stats,
      closed_at = excluded.closed_at
    returning * into week_row;

    delete from public.week_player_stats where week_id = week_row.id;

    for stat_key, stat_val in select key, value from jsonb_each(coalesce(h->'stats', '{}'::jsonb))
    loop
      insert into public.week_player_stats (week_id, player_id, wins, losses, kills, deaths)
      values (
        week_row.id,
        stat_key,
        coalesce(public.parse_score(stat_val->'w'), 0),
        coalesce(public.parse_score(stat_val->'l'), 0),
        coalesce(public.parse_score(stat_val->'k'), 0),
        coalesce(public.parse_score(stat_val->'d'), 0)
      );
    end loop;
  end loop;

  insert into public.camp_state (id, data, updated_at)
  values ('main', payload, now())
  on conflict (id) do update set data = excluded.data, updated_at = now();

  return public.load_camp_state();
end;
$$;

grant execute on function public.parse_score(jsonb) to service_role;
grant execute on function public.score_text(int) to service_role;
grant execute on function public.load_camp_state() to service_role;
grant execute on function public.save_camp_state(jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos',
  'player-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "player photos public read" on storage.objects;
create policy "player photos public read"
  on storage.objects for select
  using (bucket_id = 'player-photos');
