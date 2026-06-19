-- Cole este script uma vez no SQL Editor do Supabase (Database > SQL Editor > New query).

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
  status text not null default 'pendente', -- 'pendente' | 'enviado' | 'erro'
  erro text,
  criado_em timestamptz not null default now(),
  processado_em timestamptz
);

alter table etiquetas enable row level security;
alter table fila_impressao enable row level security;
-- Sem policies: só a service_role key (usada só no backend /api e no agente local) acessa essas tabelas.
-- O navegador nunca recebe a service_role key, só fala com as funções /api.
