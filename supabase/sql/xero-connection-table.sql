-- Singleton table holding the OAuth tokens for the connected Xero org.
-- One row, ever. Service-role only — tokens here let anyone read Vue
-- Mastery's accounting data, so we keep the anon/authenticated roles out.
--
-- Run in Supabase Dashboard → SQL Editor.

create table if not exists public.xero_connection (
  id            integer primary key default 1 check (id = 1),
  tenant_id     text not null,
  tenant_name   text,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now()
);

alter table public.xero_connection enable row level security;
-- No policies — only service-role (which bypasses RLS) can touch this.
