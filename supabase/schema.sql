-- Cole este script inteiro no SQL Editor do Supabase (Database > SQL Editor > New query).
-- Pode rodar múltiplas vezes sem erros (usa IF NOT EXISTS e ON CONFLICT DO NOTHING).

create table if not exists etiquetas (
  id bigint generated always as identity primary key,
  nome text not null default '',
  matricula text not null default '',
  cpf text not null default '',
  data_admissao date,
  status text not null default 'Pendente', -- 'Pendente' | 'Na fila' | 'Impresso'
  created_at timestamptz not null default now()
);

create table if not exists fila_impressao (
  id bigint generated always as identity primary key,
  etiqueta_id bigint references etiquetas(id) not null,
  status text not null default 'pendente', -- 'pendente' | 'processando' | 'enviado' | 'erro'
  erro text,
  criado_em timestamptz not null default now(),
  processado_em timestamptz
);

alter table etiquetas enable row level security;
alter table fila_impressao enable row level security;

-- Perfis de usuários: role e flag de primeiro acesso
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null default 'user', -- 'admin' | 'user'
  force_password_change boolean not null default true,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- Logs do sistema: toda ação registrada para auditoria
create table if not exists logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  acao text not null,
  detalhes jsonb default '{}'::jsonb,
  ip text default '',
  criado_em timestamptz not null default now()
);
alter table logs enable row level security;

-- Torna gao@acaps.sc.gov.br super admin com acesso imediato (sem troca de senha forçada)
insert into profiles (id, role, force_password_change)
values ('da7753a1-7205-40d2-ab52-c4f4311565f9', 'admin', false)
on conflict (id) do update set role = 'admin', force_password_change = false;

-- Sem RLS policies nas 3 tabelas: só o backend (service_role) acessa.
