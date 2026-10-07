-- ============================================================
--  DOCE E BRASA · tabela de avaliações dos clientes
--  Rodar uma vez no Supabase → SQL Editor.
--
--  Toda avaliação nasce "pendente" e só aparece no site depois
--  de aprovada no painel (/admin.html → Avaliações).
--  RLS ligado e sem política, igual a docebrasa_pedidos: só as
--  funções em /api, com a service_role, leem e gravam.
-- ============================================================

create table if not exists public.docebrasa_avaliacoes (
  id           bigint generated always as identity primary key,
  criado_em    timestamptz not null default now(),
  produto      text        not null check (produto in ('abacaxi', 'cebola', 'morango', 'morango-zero')),
  nota         smallint    not null check (nota between 1 and 5),
  texto        text        not null check (char_length(texto) between 10 and 600),
  nome         text        not null check (char_length(nome) between 2 and 60),
  cidade       text                 check (char_length(cidade) <= 60),
  email        text                 check (char_length(email) <= 120),
  status       text        not null default 'pendente'
                           check (status in ('pendente', 'aprovada', 'recusada')),
  aprovada_em  timestamptz,
  ip_hash      text
);

create index if not exists docebrasa_avaliacoes_status_idx
  on public.docebrasa_avaliacoes (status, aprovada_em desc);

create index if not exists docebrasa_avaliacoes_ip_idx
  on public.docebrasa_avaliacoes (ip_hash, criado_em desc);

alter table public.docebrasa_avaliacoes enable row level security;
