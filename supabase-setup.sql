-- ═══════════════════════════════════════════════════════════════
-- BonusProd v4 — Script de criação do banco de dados
-- Meta em PONTOS por colaborador + Produção real = Acabamento
-- Execute este SQL no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. TABELA DE USUÁRIOS (agora com points_goal = meta em pontos)
create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  login text unique not null,
  password text not null,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  sector_ids text[] default '{}',
  points_goal integer not null default 500,
  created_at timestamptz default now()
);

-- 2. TABELA DE SETORES (sem meta mensal, só pontos por unidade)
create table if not exists sectors (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  points_per_unit numeric not null default 1,
  is_final boolean not null default false,
  created_at timestamptz default now()
);

-- 3. TABELA DE PRODUÇÃO
create table if not exists production (
  id text primary key default gen_random_uuid()::text,
  user_id text references users(id) on delete cascade,
  sector_id text references sectors(id) on delete cascade,
  quantity integer not null,
  date date not null,
  created_at timestamptz default now()
);

-- 4. TABELA DE CONFIGURAÇÕES
create table if not exists config (
  id integer primary key default 1 check (id = 1),
  point_value numeric not null default 0.50,
  min_goal_percent integer not null default 100,
  final_sector_id text default null
);

-- 5. TABELA DE HISTÓRICO MENSAL
create table if not exists history (
  id text primary key default gen_random_uuid()::text,
  month_key text not null,
  closed_at timestamptz default now(),
  point_value numeric not null,
  employees jsonb not null default '[]'
);

-- 6. TABELA DE LOGS
create table if not exists logs (
  id text primary key default gen_random_uuid()::text,
  user_id text,
  user_name text,
  action text not null,
  details text,
  created_at timestamptz default now()
);

-- ÍNDICES
create index if not exists idx_production_user on production(user_id);
create index if not exists idx_production_date on production(date);
create index if not exists idx_production_sector on production(sector_id);
create index if not exists idx_logs_created on logs(created_at desc);

-- RLS com policies abertas
alter table users enable row level security;
alter table sectors enable row level security;
alter table production enable row level security;
alter table config enable row level security;
alter table history enable row level security;
alter table logs enable row level security;

create policy "Allow all on users" on users for all using (true) with check (true);
create policy "Allow all on sectors" on sectors for all using (true) with check (true);
create policy "Allow all on production" on production for all using (true) with check (true);
create policy "Allow all on config" on config for all using (true) with check (true);
create policy "Allow all on history" on history for all using (true) with check (true);
create policy "Allow all on logs" on logs for all using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════
-- DADOS INICIAIS
-- ═══════════════════════════════════════════════════════════════

-- Setores (Acabamento é o setor final, is_final=true)
insert into sectors (id, name, points_per_unit, is_final) values
  ('s1', 'Acabamento', 2, true),
  ('s2', 'CO2', 3, false),
  ('s3', 'Desmonte', 2.5, false),
  ('s4', 'Carga', 2, false),
  ('s5', 'Decapagem', 1.5, false),
  ('s6', 'Pintura', 2, false),
  ('s7', 'Teste Hidrostático', 4, false)
on conflict (id) do nothing;

-- Configuração (final_sector_id aponta para Acabamento)
insert into config (id, point_value, min_goal_percent, final_sector_id) values (1, 0.50, 100, 's1')
on conflict (id) do nothing;

-- Admin padrão
insert into users (id, name, login, password, role, sector_ids, points_goal) values
  ('u0', 'Administrador', 'admin', 'admin123', 'admin', '{}', 0)
on conflict (id) do nothing;
