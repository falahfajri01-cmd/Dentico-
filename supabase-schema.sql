-- Dentico Finance — Supabase Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension (optional, but useful)
create extension if not exists "uuid-ossp";

-- ============================================
-- BRANCHES
-- ============================================
create table branches (
  id serial primary key,
  code varchar(8) not null unique,   -- SW, KH, WB...
  name varchar(80) not null,         -- Sleman West
  city varchar(40) not null,         -- Yogyakarta / Bandung / Jakarta
  brand varchar(60) not null         -- Dentico Smile / Care / Kids / Premium
);

-- ============================================
-- DAILY SUMMARIES
-- ============================================
create table daily_summaries (
  id serial primary key,
  branch_id integer not null references branches(id),
  date varchar(10) not null,         -- YYYY-MM-DD
  shift_done integer not null default 3,
  shift_total integer not null default 3,
  app_revenue integer not null,      -- omzet dari aplikasi EMR
  branch_revenue integer not null,   -- omzet input cabang
  shift_revenue integer not null,    -- omzet laporan shift (WA)
  diff_app_branch integer not null default 0,   -- App - Branch
  diff_branch_shift integer not null default 0, -- Branch - Shift
  status varchar(16) not null default 'CLOSED', -- CLOSED | FOLLOW_UP | OPEN
  sort_key integer not null default 0,
  created_at timestamp with time zone not null default now()
);

-- Index for common queries
create index daily_summaries_branch_date_idx on daily_summaries(branch_id, date);
create index daily_summaries_status_idx on daily_summaries(status);

-- ============================================
-- TRANSACTIONS
-- ============================================
create table transactions (
  id serial primary key,
  summary_id integer not null references daily_summaries(id),
  source varchar(10) not null,       -- APP | BRANCH | SHIFT
  reference varchar(32) not null,    -- TX-WB-0921-03 / Row #42
  patient_name varchar(80) not null,
  treatment varchar(120) not null,
  channel varchar(12) not null,      -- CASH | QRIS | EDC | TRANSFER
  amount integer not null,
  input_by varchar(80) not null default '',
  status varchar(20) not null default 'OK',  -- OK | MISMATCH | MISSING
  note text not null default '',
  flagged boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index transactions_summary_idx on transactions(summary_id);
create index transactions_source_idx on transactions(source);

-- ============================================
-- SHIFT REPORTS
-- ============================================
create table shift_reports (
  id serial primary key,
  summary_id integer not null references daily_summaries(id),
  shift_index integer not null,      -- 1..3
  cashier varchar(80) not null,
  supervisor varchar(80) not null,
  expected_amount integer not null,  -- ekspektasi dari app
  physical_amount integer not null,  -- fisik laci kasir
  variance integer not null default 0,
  status varchar(16) not null default 'MATCH', -- MATCH | OVER | UNDER | PENDING
  note text not null default '',
  handover_at varchar(8) not null default '',
  qris_amount integer not null default 0,
  transfer_amount integer not null default 0,
  edc_amount integer not null default 0,
  cash_amount integer not null default 0
);

create index shift_reports_summary_idx on shift_reports(summary_id);

-- ============================================
-- PAYMENT CHECKS (Settlement Verification)
-- ============================================
create table payment_checks (
  id serial primary key,
  summary_id integer not null references daily_summaries(id),
  channel varchar(12) not null,      -- QRIS | EDC | TRANSFER
  account_label varchar(40) not null, -- QRIS BCA / EDC Mandiri
  expected integer not null,
  actual integer,                    -- null = belum settlement
  status varchar(16) not null default 'MATCH', -- MATCH | PENDING | EXCEPTION | NONE
  reference varchar(40) not null default '',
  note text not null default ''
);

create index payment_checks_summary_idx on payment_checks(summary_id);
create index payment_checks_channel_idx on payment_checks(channel);

-- ============================================
-- EXCEPTIONS
-- ============================================
create table exceptions (
  id serial primary key,
  summary_id integer not null references daily_summaries(id),
  severity varchar(8) not null default 'MEDIUM', -- HIGH | MEDIUM | LOW
  title varchar(140) not null,
  description text not null,
  owner varchar(80) not null,
  status varchar(16) not null default 'OPEN', -- OPEN | FOLLOW_UP | RESOLVED
  created_at timestamp with time zone not null default now()
);

create index exceptions_summary_idx on exceptions(summary_id);
create index exceptions_status_idx on exceptions(status);

-- ============================================
-- AUDIT LOGS
-- ============================================
create table audit_logs (
  id serial primary key,
  summary_id integer references daily_summaries(id),
  action varchar(40) not null,       -- SYNC_APP, MANUAL_EDIT...
  actor varchar(80) not null,
  role varchar(40) not null,
  detail text not null,
  hash varchar(24) not null,
  prev_hash varchar(24) not null,
  verified boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create index audit_logs_summary_idx on audit_logs(summary_id);
create index audit_logs_created_idx on audit_logs(created_at desc);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables
alter table branches enable row level security;
alter table daily_summaries enable row level security;
alter table transactions enable row level security;
alter table shift_reports enable row level security;
alter table payment_checks enable row level security;
alter table exceptions enable row level security;
alter table audit_logs enable row level security;

-- Allow all operations for anon key (public access) - for static export app
create policy "Allow all for anon" on branches for all using (true) with check (true);
create policy "Allow all for anon" on daily_summaries for all using (true) with check (true);
create policy "Allow all for anon" on transactions for all using (true) with check (true);
create policy "Allow all for anon" on shift_reports for all using (true) with check (true);
create policy "Allow all for anon" on payment_checks for all using (true) with check (true);
create policy "Allow all for anon" on exceptions for all using (true) with check (true);
create policy "Allow all for anon" on audit_logs for all using (true) with check (true);

-- Also allow authenticated users (for future auth integration)
create policy "Allow all for authenticated" on branches for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on daily_summaries for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on transactions for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on shift_reports for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on payment_checks for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on exceptions for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on audit_logs for all using (auth.role() = 'authenticated');