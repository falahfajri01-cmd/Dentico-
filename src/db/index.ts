import { supabase } from '@/lib/supabase';

export const db = supabase;

export type Branch = {
  id: number;
  code: string;
  name: string;
  city: string;
  brand: string;
};

export type DailySummary = {
  id: number;
  branch_id: number;
  date: string;
  shift_done: number;
  shift_total: number;
  app_revenue: number;
  branch_revenue: number;
  shift_revenue: number;
  diff_app_branch: number;
  diff_branch_shift: number;
  status: string;
  sort_key: number;
  created_at: string;
};

export type Transaction = {
  id: number;
  summary_id: number;
  source: string;
  reference: string;
  patient_name: string;
  treatment: string;
  channel: string;
  amount: number;
  input_by: string;
  status: string;
  note: string;
  flagged: boolean;
  created_at: string;
};

export type ShiftReport = {
  id: number;
  summary_id: number;
  shift_index: number;
  cashier: string;
  supervisor: string;
  expected_amount: number;
  physical_amount: number;
  variance: number;
  status: string;
  note: string;
  handover_at: string;
  qris_amount: number;
  transfer_amount: number;
  edc_amount: number;
  cash_amount: number;
};

export type PaymentCheck = {
  id: number;
  summary_id: number;
  channel: string;
  account_label: string;
  expected: number;
  actual: number | null;
  status: string;
  reference: string;
  note: string;
};

export type ExceptionItem = {
  id: number;
  summary_id: number;
  severity: string;
  title: string;
  description: string;
  owner: string;
  status: string;
  created_at: string;
};

export type AuditLog = {
  id: number;
  summary_id: number | null;
  action: string;
  actor: string;
  role: string;
  detail: string;
  hash: string;
  prev_hash: string;
  verified: boolean;
  created_at: string;
};