-- LMSpend schema for Supabase Postgres.
-- Run this once in the Supabase SQL editor (Database → SQL Editor → New query → paste → Run).
--
-- Access model: the app talks to these tables ONLY through the server-side
-- service-role client (src/lib/store.ts). RLS is enabled with no policies, so
-- the anon/browser key can read nothing. Supabase Auth handles sign-in.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  plan          text not null default 'solo',          -- solo | team
  sub_status    text not null default 'none',          -- active | past_due | cancelled | expired | none
  paid_until    timestamptz,                           -- access window (31 days per Kora charge)
  email_reports boolean not null default true,         -- monthly report emails
  realtime_enabled boolean not null default false,     -- live watch daemon opt-in (paid)
  external_customer_id text,
  created_at    timestamptz not null default now()
);

create table if not exists api_keys (
  key_hash      text primary key,                      -- sha256 of the raw key; raw is never stored
  key_prefix    text not null,                         -- first 16 chars, for display ("lm_live_a1b2c3d4")
  user_id       uuid not null references users(id) on delete cascade,
  label         text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists api_keys_user_idx on api_keys(user_id);

create table if not exists monthly_spend (
  user_id       uuid not null references users(id) on delete cascade,
  month         text not null,                         -- YYYY-MM
  total_usd     numeric(12,4) not null,
  plan_monthly  numeric(12,2),                         -- user's flat plan cost (for ROI display)
  roi_multiple  numeric(8,2),                          -- API value ÷ flat cost
  by_tool       jsonb not null,
  by_model      jsonb not null,
  by_project    jsonb not null,                        -- hashed project names only
  by_day        jsonb not null,
  synced_at     timestamptz not null default now(),
  primary key (user_id, month)
);

create table if not exists budgets (
  user_id       uuid primary key references users(id) on delete cascade,
  monthly_limit_usd numeric(12,2),                     -- null = no limit set (row may hold Slack webhook)
  notify_email  boolean not null default true,
  notify_slack_webhook text
);

-- Team workspaces (Team plan): owner pays, members join by invite link.
create table if not exists teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id uuid not null references users(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create table if not exists team_members (
  team_id       uuid not null references teams(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          text not null default 'member',       -- owner | member
  created_at    timestamptz not null default now(),
  primary key (team_id, user_id)
);
create unique index if not exists team_members_one_team_per_user on team_members(user_id);

create table if not exists team_invites (
  token         text primary key,
  team_id       uuid not null references teams(id) on delete cascade,
  created_at    timestamptz not null default now()
);

-- Anonymous share cards published from the CLI (aggregate numbers only).
create table if not exists shares (
  slug          text primary key,
  month         text not null,
  total_usd     numeric(12,2) not null,
  top_model     text,
  top_model_usd numeric(12,2),
  top_day       text,
  top_day_usd   numeric(12,2),
  plan_monthly  numeric(12,2),
  roi_multiple  numeric(8,1),
  created_at    timestamptz not null default now()
);

-- Adapter waitlists (Cursor etc.) — doubles as launch social proof.
create table if not exists waitlist (
  email         text not null,
  tool          text not null,
  created_at    timestamptz not null default now(),
  primary key (email, tool)
);

-- Lock everything down: service role bypasses RLS; anon key gets nothing.
alter table users enable row level security;
alter table api_keys enable row level security;
alter table monthly_spend enable row level security;
alter table budgets enable row level security;
alter table shares enable row level security;
alter table waitlist enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;

-- If upgrading an existing database, also run:
-- alter table users add column if not exists paid_until timestamptz;
-- alter table users add column if not exists email_reports boolean not null default true;
-- alter table monthly_spend add column if not exists plan_monthly numeric(12,2);
-- alter table monthly_spend add column if not exists roi_multiple numeric(8,2);
-- alter table budgets alter column monthly_limit_usd drop not null;
-- alter table users add column if not exists realtime_enabled boolean not null default false;
-- (plus the teams / team_members / team_invites blocks above if they don't exist yet)
