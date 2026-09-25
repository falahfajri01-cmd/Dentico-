import { getSupabase } from '@/lib/supabase';
import { dateShort } from '@/lib/format';
import type { MatchState, SummaryRow, SheetPayload } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

function getClient(): SupabaseClient | null {
  const client = getSupabase();
  // During build/SSR, return null instead of throwing
  if (!client) return null;
  return client;
}

function statusFromSources(params: {
  diffAppBranch: number;
  diffBranchShift: number;
  shiftDone: number;
  qris: MatchState;
  edc: MatchState;
  transfer: MatchState;
}): SummaryRow['status'] {
  const hasHardVariance = params.diffAppBranch !== 0 || params.diffBranchShift !== 0;
  const hasPending = [params.qris, params.edc, params.transfer].includes('PENDING');
  const hasException = [params.qris, params.edc, params.transfer].includes('EXCEPTION');
  if (hasHardVariance || params.shiftDone < 3) return 'OPEN';
  if (hasPending || hasException) return 'FOLLOW_UP';
  return 'CLOSED';
}

function channelState(checks: Array<{ channel: string; status: string }>, channel: 'QRIS' | 'EDC' | 'TRANSFER'): MatchState {
  const item = checks.find((c) => c.channel === channel);
  return (item?.status as MatchState | undefined) ?? 'NONE';
}

async function getBranchUniverse(filters: { brand?: string; city?: string; branchCode?: string; q?: string }) {
  const client = getClient();
  if (!client) return { allBranches: [] as any[], filteredBranches: [] as any[] };
  
  let query = client.from('branches').select('*').order('code', { ascending: true });
  const { data: allBranches, error } = await query;
  if (error) throw error;

  const branches = (allBranches ?? []) as Array<{ id: number; code: string; name: string; city: string; brand: string }>;
  const filteredBranches = branches.filter((b) => {
    const matchBrand = !filters.brand || b.brand === filters.brand;
    const matchCity = !filters.city || b.city === filters.city;
    const matchBranch = !filters.branchCode || b.code === filters.branchCode;
    const matchQ =
      !filters.q || `${b.code} ${b.name} ${b.city} ${b.brand}`.toLowerCase().includes(filters.q.toLowerCase());
    return matchBrand && matchCity && matchBranch && matchQ;
  });
  return { allBranches: branches, filteredBranches };
}

async function getAggregatedSourceMaps(summaryIds: number[]) {
  if (summaryIds.length === 0) {
    return {
      txns: [] as Array<{ summary_id: number; source: string; amount: number }>,
      shifts: [] as Array<{ summary_id: number; physical_amount: number; shift_index: number }>,
      checks: [] as Array<{ summary_id: number; channel: string; status: string }>,
    };
  }

  const client = getClient();
  if (!client) {
    return {
      txns: [] as Array<{ summary_id: number; source: string; amount: number }>,
      shifts: [] as Array<{ summary_id: number; physical_amount: number; shift_index: number }>,
      checks: [] as Array<{ summary_id: number; channel: string; status: string }>,
    };
  }
  
  const [txnsRes, shiftsRes, checksRes] = await Promise.all([
    client.from('transactions').select('summary_id, source, amount').in('summary_id', summaryIds),
    client.from('shift_reports').select('summary_id, physical_amount, shift_index').in('summary_id', summaryIds),
    client.from('payment_checks').select('summary_id, channel, status').in('summary_id', summaryIds),
  ]);

  if (txnsRes.error) throw txnsRes.error;
  if (shiftsRes.error) throw shiftsRes.error;
  if (checksRes.error) throw checksRes.error;

  return {
    txns: txnsRes.data ?? [],
    shifts: shiftsRes.data ?? [],
    checks: checksRes.data ?? [],
  };
}

function aggregateForSummary(
  summary: { id: number; branch_id: number; date: string; shift_done: number; app_revenue: number; branch_revenue: number; shift_revenue: number; diff_app_branch: number; diff_branch_shift: number; status: string; sort_key: number },
  branch: { id: number; code: string; name: string; city: string; brand: string },
  txns: Array<{ summary_id: number; source: string; amount: number }>,
  shifts: Array<{ summary_id: number; physical_amount: number; shift_index: number }>,
  checks: Array<{ summary_id: number; channel: string; status: string }>,
  rowIndex: number,
): SummaryRow {
  const localTx = txns.filter((t) => t.summary_id === summary.id);
  const localShifts = shifts.filter((s) => s.summary_id === summary.id);
  const localChecks = checks.filter((c) => c.summary_id === summary.id);

  const appRevenue = localTx.filter((t) => t.source === 'APP').reduce((s, t) => s + t.amount, 0);
  const branchRevenue = localTx.filter((t) => t.source === 'BRANCH').reduce((s, t) => s + t.amount, 0);
  const shiftRevenue = localShifts.reduce((s, t) => s + t.physical_amount, 0);
  const shiftDone = new Set(localShifts.map((s) => s.shift_index)).size;
  const diffAppBranch = appRevenue - branchRevenue;
  const diffBranchShift = branchRevenue - shiftRevenue;
  const qris = channelState(localChecks, 'QRIS');
  const edc = channelState(localChecks, 'EDC');
  const transfer = channelState(localChecks, 'TRANSFER');
  const status = statusFromSources({ diffAppBranch, diffBranchShift, shiftDone, qris, edc, transfer });

  return {
    id: summary.id,
    rowIndex,
    cellRef: `${COLS[(rowIndex - 1) % COLS.length]}${rowIndex}`,
    date: summary.date,
    dateLabel: dateShort(summary.date),
    branchCode: branch.code,
    branchName: branch.name,
    city: branch.city,
    brand: branch.brand,
    shiftDone,
    shiftTotal: 3,
    appRevenue,
    branchRevenue,
    shiftRevenue,
    diffAppBranch,
    diffBranchShift,
    qris,
    edc,
    transfer,
    status,
  };
}

export async function listSummaries(opts: {
  status?: string;
  q?: string;
  brand?: string;
  city?: string;
  branchCode?: string;
  page: number;
  pageSize: number;
}) {
  const client = getClient();
  if (!client) {
    return {
      rows: [] as SummaryRow[],
      total: 0,
      page: opts.page,
      pageSize: opts.pageSize,
      counts: { total: 0, CLOSED: 0, FOLLOW_UP: 0, OPEN: 0 },
    };
  }

  const { allBranches, filteredBranches } = await getBranchUniverse(opts);
  if (filteredBranches.length === 0) {
    return {
      rows: [] as SummaryRow[],
      total: 0,
      page: opts.page,
      pageSize: opts.pageSize,
      counts: { total: 0, CLOSED: 0, FOLLOW_UP: 0, OPEN: 0 },
    };
  }

  const branchIds = filteredBranches.map((b) => b.id);
  const { data: summaryRows, error } = await client
    .from('daily_summaries')
    .select('*')
    .in('branch_id', branchIds)
    .order('date', { ascending: true })
    .order('sort_key', { ascending: true });

  if (error) throw error;

  const summaries = (summaryRows ?? []) as Array<{ id: number; branch_id: number; date: string; shift_done: number; app_revenue: number; branch_revenue: number; shift_revenue: number; diff_app_branch: number; diff_branch_shift: number; status: string; sort_key: number }>;
  const maps = await getAggregatedSourceMaps(summaries.map((r) => r.id));
  let computed = summaries.map((r, i) =>
    aggregateForSummary(r, filteredBranches.find((b) => b.id === r.branch_id)!, maps.txns, maps.shifts, maps.checks, i + 1)
  );

  if (opts.status && ['CLOSED', 'FOLLOW_UP', 'OPEN'].includes(opts.status)) {
    computed = computed.filter((r) => r.status === opts.status);
  }
  if (opts.q) {
    const q = opts.q.toLowerCase();
    computed = computed.filter((r) => `${r.branchCode} ${r.branchName} ${r.city} ${r.brand}`.toLowerCase().includes(q));
  }

  const counts = {
    total: computed.length,
    CLOSED: computed.filter((r) => r.status === 'CLOSED').length,
    FOLLOW_UP: computed.filter((r) => r.status === 'FOLLOW_UP').length,
    OPEN: computed.filter((r) => r.status === 'OPEN').length,
  };

  const start = (opts.page - 1) * opts.pageSize;
  const paged = computed.slice(start, start + opts.pageSize).map((r, i) => ({ ...r, rowIndex: start + i + 1 }));

  void allBranches;
  return {
    rows: paged,
    total: computed.length,
    page: opts.page,
    pageSize: opts.pageSize,
    counts,
  };
}

export async function getSummaryCounts(filters: { brand?: string; city?: string; branchCode?: string }) {
  const page = await listSummaries({ ...filters, page: 1, pageSize: 1000 });
  return page.counts;
}

export async function getDetail(id: number) {
  const client = getClient();
  if (!client) return null;

  const [summaryRes, branchesRes] = await Promise.all([
    client.from('daily_summaries').select('*').eq('id', id).single(),
    client.from('branches').select('*'),
  ]);
  if (summaryRes.error || !summaryRes.data) return null;
  if (branchesRes.error) throw branchesRes.error;

  const summary = summaryRes.data as { id: number; branch_id: number; date: string; shift_done: number; app_revenue: number; branch_revenue: number; shift_revenue: number; diff_app_branch: number; diff_branch_shift: number; status: string; sort_key: number };
  const branch = (branchesRes.data ?? []).find((b) => b.id === summary.branch_id) as { id: number; code: string; name: string; city: string; brand: string } | undefined;
  if (!branch) return null;

  const [txnsRes, shiftsRes, paysRes, excsRes, logsRes] = await Promise.all([
    client.from('transactions').select('*').eq('summary_id', id),
    client.from('shift_reports').select('*').eq('summary_id', id),
    client.from('payment_checks').select('*').eq('summary_id', id),
    client.from('exceptions').select('*').eq('summary_id', id),
    client.from('audit_logs').select('*').eq('summary_id', id).order('created_at', { ascending: false }).limit(8),
  ]);

  if (txnsRes.error) throw txnsRes.error;
  if (shiftsRes.error) throw shiftsRes.error;
  if (paysRes.error) throw paysRes.error;
  if (excsRes.error) throw excsRes.error;
  if (logsRes.error) throw logsRes.error;

  const agg = aggregateForSummary(summary, branch, txnsRes.data ?? [], shiftsRes.data ?? [], paysRes.data ?? [], 1);

  return {
    summary: agg,
    txns: (txnsRes.data ?? []).sort((a, b) => a.reference.localeCompare(b.reference)),
    shifts: (shiftsRes.data ?? []).sort((a, b) => a.shift_index - b.shift_index),
    payments: paysRes.data ?? [],
    exceptions: (excsRes.data ?? []).map((e) => ({ ...e, createdAt: e.created_at })),
    logs: (logsRes.data ?? []).map((l) => ({ ...l, createdAt: l.created_at })),
  };
}

export async function getMeta(filters?: { brand?: string; city?: string; branchCode?: string }) {
  const client = getClient();
  if (!client) {
    return {
      period: '',
      counts: { total: 0, CLOSED: 0, FOLLOW_UP: 0, OPEN: 0 },
      totals: { app: 0, branch: 0, shift: 0, openVariance: 0, matchRate: 0 },
      branches: [],
      cities: [],
      brands: [],
      alerts: [],
      logs: [],
    };
  }

  const { allBranches, filteredBranches } = await getBranchUniverse(filters ?? {});
  const overview = await listSummaries({ ...(filters ?? {}), page: 1, pageSize: 1000 });
  const allSummaries = overview.rows;

  const totals = { app: 0, branch: 0, shift: 0, openVariance: 0 };
  for (const s of allSummaries) {
    totals.app += s.appRevenue;
    totals.branch += s.branchRevenue;
    totals.shift += s.shiftRevenue;
    if (s.status !== 'CLOSED') {
      totals.openVariance += Math.max(Math.abs(s.diffAppBranch), Math.abs(s.diffBranchShift));
    }
  }

  const summaryIds = overview.rows.map((r) => r.id);
  let exceptionRows: Array<{ e: any; s: any; b: any }> = [];
  if (summaryIds.length > 0) {
    const { data, error } = await client
      .from('exceptions')
      .select('*, daily_summaries!inner(*, branches!inner(*))')
      .in('summary_id', summaryIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    exceptionRows = (data ?? []).map((r) => ({
      e: r,
      s: r.daily_summaries,
      b: r.daily_summaries.branches,
    }));
  }

  const { data: recentLogs, error: logsError } = await client
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(6);
  if (logsError) throw logsError;

  const dates = overview.rows.map((s) => s.date).sort();
  const first = dates[0] ?? '2026-09-16';
  const last = dates[dates.length - 1] ?? '2026-09-21';
  const brandScopedCities = [...new Set(filteredBranches.map((b) => b.city))];

  return {
    period: `${dateShort(first)} - ${dateShort(last)} ${first.slice(0, 4)}`,
    counts: overview.counts,
    totals: {
      ...totals,
      matchRate: overview.counts.total ? Math.round((overview.counts.CLOSED / overview.counts.total) * 100) : 0,
    },
    branches: allBranches.map((b) => ({ id: b.id, code: b.code, name: b.name, city: b.city, brand: b.brand })),
    cities: brandScopedCities,
    brands: [...new Set(allBranches.map((b) => b.brand))],
    alerts: exceptionRows
      .filter((r) => r.e.status === 'OPEN' || r.e.status === 'FOLLOW_UP')
      .map((r) => ({
        id: r.e.id,
        title: r.e.title,
        severity: r.e.severity,
        summaryId: r.e.summary_id,
        branchCode: r.b.code,
      })),
    logs: (recentLogs ?? []).map((l) => ({ ...l, createdAt: l.created_at })),
  };
}

async function getFilteredBranchIds(filters: { brand?: string; city?: string; branchCode?: string }) {
  const client = getClient();
  if (!client) return [];

  let query = client.from('branches').select('id, code, name, city, brand');
  const { data: branches, error } = await query;
  if (error) throw error;
  return (branches ?? [])
    .filter((b) => (!filters.brand || b.brand === filters.brand) && (!filters.city || b.city === filters.city) && (!filters.branchCode || b.code === filters.branchCode))
    .map((b) => b.id);
}

const NO_COL = { key: 'no', label: '#', align: 'center' as const };

export async function buildSheet(
  sheet: string,
  filters: { brand?: string; city?: string; branchCode?: string },
): Promise<SheetPayload | null> {
  const client = getClient();
  if (!client) return { sheet: sheet as SheetPayload['sheet'], columns: [], rows: [] };

  const branchIds = await getFilteredBranchIds(filters);
  if (branchIds.length === 0) {
    return { sheet: sheet as SheetPayload['sheet'], columns: [], rows: [] };
  }

  switch (sheet) {
    case 'shift': {
      const { data: shifts, error } = await client
        .from('shift_reports')
        .select('*, daily_summaries!inner(id, date, sort_key, branch_id), branches!inner(id, code, name)')
        .in('daily_summaries.branch_id', branchIds)
        .order('daily_summaries.sort_key', { ascending: true })
        .order('shift_index', { ascending: true });
      if (error) throw error;

      return {
        sheet: 'shift',
        columns: [
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang' },
          { key: 'shift', label: 'Shift' },
          { key: 'pendapatan', label: '# Pendapatan' },
          { key: 'qris', label: '# QRIS' },
          { key: 'transfer', label: '# Transfer' },
          { key: 'edc', label: '# EDC' },
          { key: 'cash', label: '# Cash' },
        ],
        rows: (shifts ?? []).map((r) => ({
          id: r.id,
          summaryId: r.daily_summaries.id,
          tanggal: dateShort(r.daily_summaries.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          branchCode: r.branches.code,
          branchName: r.branches.name,
          shift: r.shift_index,
          kasir: r.cashier,
          spv: r.supervisor,
          pendapatan: r.physical_amount,
          qris: r.qris_amount,
          transfer: r.transfer_amount,
          edc: r.edc_amount,
          cash: r.cash_amount,
          ekspektasi: r.expected_amount,
          selisih: r.variance,
          status: r.status,
        })),
      };
    }
    case 'app':
    case 'branch': {
      const source = sheet === 'app' ? 'APP' : 'BRANCH';
      const { data: txns, error } = await client
        .from('transactions')
        .select('*, daily_summaries!inner(id, date, sort_key, branch_id), branches!inner(id, code, name)')
        .eq('source', source)
        .in('daily_summaries.branch_id', branchIds)
        .order('daily_summaries.sort_key', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;

      return {
        sheet: sheet as SheetPayload['sheet'],
        columns: [
          NO_COL,
          { key: 'ref', label: sheet === 'app' ? 'Ref Transaksi' : 'Sel Sheet' },
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang', badge: 'branch' },
          { key: 'pasien', label: 'Pasien' },
          { key: 'tindakan', label: 'Tindakan' },
          { key: 'channel', label: 'Channel', align: 'center', badge: 'channel' },
          { key: 'input', label: 'Diinput Oleh' },
          { key: 'nominal', label: 'Nominal', align: 'right', money: true },
          { key: 'status', label: 'Validasi', align: 'center', badge: 'match' },
        ],
        rows: (txns ?? []).map((r, i) => ({
          id: r.id,
          no: i + 1,
          summaryId: r.daily_summaries.id,
          ref: r.reference,
          tanggal: dateShort(r.daily_summaries.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          pasien: r.patient_name,
          tindakan: r.treatment,
          channel: r.channel,
          input: r.input_by,
          nominal: r.amount,
          status: r.status === 'MISMATCH' ? 'MISMATCH' : r.flagged ? 'REVIEW' : 'MATCH',
        })),
      };
    }
    case 'qris':
    case 'edc':
    case 'transfer': {
      const channel = sheet.toUpperCase();
      const { data: checks, error } = await client
        .from('payment_checks')
        .select('*, daily_summaries!inner(id, date, sort_key, branch_id), branches!inner(id, code, name)')
        .eq('channel', channel)
        .in('daily_summaries.branch_id', branchIds)
        .order('daily_summaries.sort_key', { ascending: true });
      if (error) throw error;

      return {
        sheet: sheet as SheetPayload['sheet'],
        columns: [
          NO_COL,
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang', badge: 'branch' },
          { key: 'akun', label: 'Akun Settlement' },
          { key: 'ekspektasi', label: 'Ekspektasi (App)', align: 'right', money: true },
          { key: 'settlement', label: 'Mutasi Bank', align: 'right', money: true },
          { key: 'selisih', label: 'Selisih', align: 'right', money: true, sign: true },
          { key: 'ref', label: 'Ref Settlement' },
          { key: 'status', label: 'Status', align: 'center', badge: 'match' },
          { key: 'catatan', label: 'Catatan' },
        ],
        rows: (checks ?? []).map((r, i) => ({
          id: r.id,
          no: i + 1,
          summaryId: r.daily_summaries.id,
          tanggal: dateShort(r.daily_summaries.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          akun: r.account_label,
          ekspektasi: r.expected,
          settlement: r.actual,
          selisih: r.actual == null ? null : r.actual - r.expected,
          ref: r.reference || '—',
          status: r.status,
          catatan: r.note || '—',
        })),
      };
    }
    case 'recon': {
      const { data: summaries, error } = await client
        .from('daily_summaries')
        .select('*, branches!inner(id, code, name)')
        .in('branch_id', branchIds)
        .or("diff_app_branch.neq.0,diff_branch_shift.neq.0,status.neq.CLOSED")
        .order('sort_key', { ascending: true });
      if (error) throw error;

      return {
        sheet: 'recon',
        columns: [
          NO_COL,
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang', badge: 'branch' },
          { key: 'app', label: 'App Revenue', align: 'right', money: true },
          { key: 'cab', label: 'Branch Revenue', align: 'right', money: true },
          { key: 'shf', label: 'Shift Revenue', align: 'right', money: true },
          { key: 'd1', label: 'Δ App−Cabang', align: 'right', money: true, sign: true },
          { key: 'd2', label: 'Δ Cabang−Shift', align: 'right', money: true, sign: true },
          { key: 'status', label: 'Status', align: 'center', badge: 'status' },
        ],
        rows: (summaries ?? []).map((r, i) => ({
          no: i + 1,
          summaryId: r.id,
          tanggal: dateShort(r.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          app: r.app_revenue,
          cab: r.branch_revenue,
          shf: r.shift_revenue,
          d1: r.diff_app_branch,
          d2: r.diff_branch_shift,
          status: r.status,
        })),
      };
    }
    case 'exception': {
      const { data: excs, error } = await client
        .from('exceptions')
        .select('*, daily_summaries!inner(id, date, diff_app_branch, diff_branch_shift, branch_id), branches!inner(id, code, name)')
        .in('daily_summaries.branch_id', branchIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return {
        sheet: 'exception',
        columns: [
          NO_COL,
          { key: 'sev', label: 'Severity', align: 'center', badge: 'severity' },
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang', badge: 'branch' },
          { key: 'judul', label: 'Temuan' },
          { key: 'deskripsi', label: 'Detail' },
          { key: 'owner', label: 'Owner' },
          { key: 'selisih', label: 'Nominal Varian', align: 'right', money: true, sign: true },
          { key: 'status', label: 'Status', align: 'center', badge: 'status' },
        ],
        rows: (excs ?? []).map((r, i) => ({
          no: i + 1,
          id: r.id,
          summaryId: r.daily_summaries.id,
          sev: r.severity,
          tanggal: dateShort(r.daily_summaries.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          judul: r.title,
          deskripsi: r.description,
          owner: r.owner,
          selisih: Math.max(Math.abs(r.daily_summaries.diff_app_branch), Math.abs(r.daily_summaries.diff_branch_shift)) * -1 || null,
          status: r.status,
        })),
      };
    }
    default:
      return null;
  }
}

function digest(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `0x${(h >>> 0).toString(16).padStart(8, '0')}${((h ^ 0xabcdef) >>> 0).toString(16).padStart(8, '0')}`.slice(0, 18);
}

export async function resolveSummary(summaryId: number) {
  const client = getClient();
  if (!client) return;

  const { data: lastLog } = await client
    .from('audit_logs')
    .select('hash')
    .order('id', { ascending: true })
    .limit(1)
    .single();

  await client.from('exceptions').update({ status: 'RESOLVED' }).eq('summary_id', summaryId);
  await client.from('daily_summaries').update({ status: 'CLOSED' }).eq('id', summaryId);
  const prevHash = lastLog?.hash ?? digest('genesis-dentico');
  await client.from('audit_logs').insert({
    summary_id: summaryId,
    action: 'RESOLVED_CLOSED',
    actor: 'Siti Rahmawati',
    role: 'Finance Controller',
    detail: 'Selisih diverifikasi controller — penyesuaian dicatat di Reconciliation, exception ditutup & sheet dikunci.',
    hash: digest(`${prevHash}RESOLVED_CLOSED${summaryId}${Date.now()}`),
    prev_hash: prevHash,
    verified: true,
  });
}

export async function addNote(summaryId: number, note: string) {
  const client = getClient();
  if (!client) return;

  const { data: lastLog } = await client
    .from('audit_logs')
    .select('hash')
    .order('id', { ascending: true })
    .limit(1)
    .single();

  const prevHash = lastLog?.hash ?? digest('genesis-dentico');
  await client.from('audit_logs').insert({
    summary_id: summaryId,
    action: 'CONTROLLER_NOTE',
    actor: 'Siti Rahmawati',
    role: 'Finance Controller',
    detail: note.slice(0, 400),
    hash: digest(`${prevHash}NOTE${summaryId}${Date.now()}`),
    prev_hash: prevHash,
    verified: true,
  });
}

export async function reopenSummary(summaryId: number) {
  const client = getClient();
  if (!client) return;
  await client.from('daily_summaries').update({ status: 'OPEN' }).eq('id', summaryId);
}

export async function updateShiftReport(
  rowId: number,
  data: {
    qrisAmount?: number;
    transferAmount?: number;
    edcAmount?: number;
    cashAmount?: number;
    note?: string;
  }
) {
  const client = getClient();
  if (!client) throw new Error('Supabase client not available');

  const { data: current, error: currentError } = await client
    .from('shift_reports')
    .select('*')
    .eq('id', rowId)
    .single();
  if (currentError || !current) throw new Error('Row not found');

  const qris = data.qrisAmount ?? current.qris_amount;
  const transfer = data.transferAmount ?? current.transfer_amount;
  const edc = data.edcAmount ?? current.edc_amount;
  const cash = data.cashAmount ?? current.cash_amount;
  const physical = qris + transfer + edc + cash;
  const variance = physical - current.expected_amount;
  const status = variance === 0 ? 'MATCH' : variance > 0 ? 'OVER' : 'UNDER';

  const { data: updated, error: updateError } = await client
    .from('shift_reports')
    .update({
      qris_amount: qris,
      transfer_amount: transfer,
      edc_amount: edc,
      cash_amount: cash,
      physical_amount: physical,
      variance,
      status,
      note: data.note ?? current.note,
    })
    .eq('id', rowId)
    .select()
    .single();

  if (updateError) throw updateError;
  return updated;
}

// Payment Checks (QRIS, EDC, Transfer) helpers
export async function updatePaymentCheck(
  rowId: number,
  data: { expected?: number; actual?: number | null; reference?: string; status?: string; note?: string }
) {
  const client = getClient();
  if (!client) throw new Error('Supabase client not available');

  const { data: updated, error } = await client
    .from('payment_checks')
    .update(data)
    .eq('id', rowId)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

export async function createPaymentCheck(
  data: {
    summary_id: number;
    channel: 'QRIS' | 'EDC' | 'TRANSFER';
    account_label: string;
    expected: number;
    actual?: number | null;
    status?: string;
    reference?: string;
    note?: string;
  }
) {
  const client = getClient();
  if (!client) throw new Error('Supabase client not available');

  const { data: created, error } = await client
    .from('payment_checks')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return created;
}

// Transactions helpers
export async function updateTransaction(
  rowId: number,
  data: {
    summary_id?: number;
    reference?: string;
    patient_name?: string;
    treatment?: string;
    channel?: string;
    amount?: number;
    input_by?: string;
    status?: string;
    note?: string;
    flagged?: boolean;
  }
) {
  const client = getClient();
  if (!client) throw new Error('Supabase client not available');

  const { data: updated, error } = await client
    .from('transactions')
    .update(data)
    .eq('id', rowId)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

export async function createTransaction(
  data: {
    summary_id: number;
    source: 'APP' | 'BRANCH' | 'SHIFT';
    reference: string;
    patient_name: string;
    treatment: string;
    channel: string;
    amount: number;
    input_by: string;
    status: string;
    note: string;
    flagged: boolean;
  }
) {
  const client = getClient();
  if (!client) throw new Error('Supabase client not available');

  const { data: created, error } = await client
    .from('transactions')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return created;
}