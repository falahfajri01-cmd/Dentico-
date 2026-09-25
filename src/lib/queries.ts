import { supabase } from '@/lib/supabase';
import type { MatchState, SummaryRow } from '@/lib/types';
import { dateShort } from '@/lib/format';

let seedPromise: Promise<unknown> | null = null;
export function seeded() {
  if (!seedPromise) {
    seedPromise = ensureSeeded().catch((e) => {
      seedPromise = null;
      throw e;
    });
  }
  return seedPromise;
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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

async function getBranchUniverse(filters: {
  brand?: string;
  city?: string;
  branchCode?: string;
  q?: string;
}) {
  let query = supabase.from('branches').select('*').order('code', { ascending: true });
  const { data: allBranches, error } = await query;
  if (error) throw error;

  const filteredBranches = (allBranches ?? []).filter((b) => {
    const matchBrand = !filters.brand || b.brand === filters.brand;
    const matchCity = !filters.city || b.city === filters.city;
    const matchBranch = !filters.branchCode || b.code === filters.branchCode;
    const matchQ =
      !filters.q || `${b.code} ${b.name} ${b.city} ${b.brand}`.toLowerCase().includes(filters.q.toLowerCase());
    return matchBrand && matchCity && matchBranch && matchQ;
  });
  return { allBranches: allBranches ?? [], filteredBranches };
}

async function getAggregatedSourceMaps(summaryIds: number[]) {
  if (summaryIds.length === 0) {
    return {
      txns: [] as Array<{ summary_id: number; source: string; amount: number }>,
      shifts: [] as Array<{ summary_id: number; physical_amount: number }>,
      checks: [] as Array<{ summary_id: number; channel: string; status: string }>,
    };
  }

  const [txnsRes, shiftsRes, checksRes] = await Promise.all([
    supabase.from('transactions').select('summary_id, source, amount').in('summary_id', summaryIds),
    supabase.from('shift_reports').select('summary_id, physical_amount').in('summary_id', summaryIds),
    supabase.from('payment_checks').select('summary_id, channel, status').in('summary_id', summaryIds),
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
  shifts: Array<{ summary_id: number; physical_amount: number }>,
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
  await seeded();
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
  const { data: summaryRows, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .in('branch_id', branchIds)
    .order('date', { ascending: true })
    .order('sort_key', { ascending: true });

  if (error) throw error;

  const maps = await getAggregatedSourceMaps((summaryRows ?? []).map((r) => r.id));
  let computed = (summaryRows ?? []).map((r, i) =>
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

export async function getSummaryCounts(filters: {
  brand?: string;
  city?: string;
  branchCode?: string;
}) {
  const page = await listSummaries({ ...filters, page: 1, pageSize: 1000 });
  return page.counts;
}

export async function getDetail(id: number) {
  await seeded();
  const [summaryRes, branchesRes] = await Promise.all([
    supabase.from('daily_summaries').select('*').eq('id', id).single(),
    supabase.from('branches').select('*'),
  ]);
  if (summaryRes.error || !summaryRes.data) return null;
  if (branchesRes.error) throw branchesRes.error;

  const summary = summaryRes.data;
  const branch = branchesRes.data?.find((b) => b.id === summary.branch_id);
  if (!branch) return null;

  const [txnsRes, shiftsRes, paysRes, excsRes, logsRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('summary_id', id),
    supabase.from('shift_reports').select('*').eq('summary_id', id),
    supabase.from('payment_checks').select('*').eq('summary_id', id),
    supabase.from('exceptions').select('*').eq('summary_id', id),
    supabase.from('audit_logs').select('*').eq('summary_id', id).order('created_at', { ascending: false }).limit(8),
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

export async function getMeta(filters?: {
  brand?: string;
  city?: string;
  branchCode?: string;
}) {
  await seeded();
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
    const { data, error } = await supabase
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

  const { data: recentLogs, error: logsError } = await supabase
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

async function ensureSeeded() {
  const { data: existing } = await supabase.from('branches').select('id').limit(1);
  if (existing && existing.length > 0) return false;

  const BRANCHES = [
    { code: 'SW', name: 'Sleman West', city: 'Yogyakarta', brand: 'Dentico Smile' },
    { code: 'KH', name: 'Kotabaru HQ', city: 'Yogyakarta', brand: 'Dentico Smile' },
    { code: 'WB', name: 'Wirobrajan', city: 'Yogyakarta', brand: 'Dentico Smile' },
    { code: 'JW', name: 'Jogja West', city: 'Yogyakarta', brand: 'Dentico Care' },
    { code: 'ST', name: 'Seturan Central', city: 'Yogyakarta', brand: 'Dentico Care' },
    { code: 'MD', name: 'Malioboro Kids', city: 'Yogyakarta', brand: 'Dentico Kids' },
    { code: 'BD', name: 'Bandung Dago', city: 'Bandung', brand: 'Dentico Smile' },
    { code: 'SP', name: 'Senopati HQ', city: 'Jakarta', brand: 'Dentico Premium' },
  ];

  const { data: branchRows, error: branchError } = await supabase.from('branches').insert(BRANCHES).select();
  if (branchError) throw branchError;

  const byCode = new Map((branchRows ?? []).map((b) => [b.code, b.id]));
  console.log('Seed complete: dummy workbook inserted.');
  return true;
}