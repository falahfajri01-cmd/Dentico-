import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  branches,
  dailySummaries,
  exceptions,
  paymentChecks,
  shiftReports,
  transactions,
} from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import type { MatchState, SummaryRow } from "@/lib/types";
import { dateShort } from "@/lib/format";

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

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];

type BranchRow = typeof branches.$inferSelect;
type SummaryRowDb = typeof dailySummaries.$inferSelect;

function statusFromSources(params: {
  diffAppBranch: number;
  diffBranchShift: number;
  shiftDone: number;
  qris: MatchState;
  edc: MatchState;
  transfer: MatchState;
}): SummaryRow["status"] {
  const hasHardVariance = params.diffAppBranch !== 0 || params.diffBranchShift !== 0;
  const hasPending = [params.qris, params.edc, params.transfer].includes("PENDING");
  const hasException = [params.qris, params.edc, params.transfer].includes("EXCEPTION");
  if (hasHardVariance || params.shiftDone < 3) return "OPEN";
  if (hasPending || hasException) return "FOLLOW_UP";
  return "CLOSED";
}

function channelState(checks: typeof paymentChecks.$inferSelect[], channel: "QRIS" | "EDC" | "TRANSFER"): MatchState {
  const item = checks.find((c) => c.channel === channel);
  return (item?.status as MatchState | undefined) ?? "NONE";
}

async function getBranchUniverse(filters: {
  brand?: string;
  city?: string;
  branchCode?: string;
  q?: string;
}) {
  const allBranches = await db.select().from(branches).orderBy(asc(branches.code));
  const filteredBranches = allBranches.filter((b) => {
    const matchBrand = !filters.brand || b.brand === filters.brand;
    const matchCity = !filters.city || b.city === filters.city;
    const matchBranch = !filters.branchCode || b.code === filters.branchCode;
    const matchQ =
      !filters.q || `${b.code} ${b.name} ${b.city} ${b.brand}`.toLowerCase().includes(filters.q.toLowerCase());
    return matchBrand && matchCity && matchBranch && matchQ;
  });
  return { allBranches, filteredBranches };
}

async function getAggregatedSourceMaps(summaryIds: number[]) {
  if (summaryIds.length === 0) {
    return {
      txns: [] as typeof transactions.$inferSelect[],
      shifts: [] as typeof shiftReports.$inferSelect[],
      checks: [] as typeof paymentChecks.$inferSelect[],
    };
  }
  const [txns, shifts, checks] = await Promise.all([
    db.select().from(transactions).where(inArray(transactions.summaryId, summaryIds)),
    db.select().from(shiftReports).where(inArray(shiftReports.summaryId, summaryIds)),
    db.select().from(paymentChecks).where(inArray(paymentChecks.summaryId, summaryIds)),
  ]);
  return { txns, shifts, checks };
}

function aggregateForSummary(
  summary: SummaryRowDb,
  branch: BranchRow,
  txns: typeof transactions.$inferSelect[],
  shifts: typeof shiftReports.$inferSelect[],
  checks: typeof paymentChecks.$inferSelect[],
  rowIndex: number,
): SummaryRow {
  const localTx = txns.filter((t) => t.summaryId === summary.id);
  const localShifts = shifts.filter((s) => s.summaryId === summary.id);
  const localChecks = checks.filter((c) => c.summaryId === summary.id);

  const appRevenue = localTx.filter((t) => t.source === "APP").reduce((s, t) => s + t.amount, 0);
  const branchRevenue = localTx.filter((t) => t.source === "BRANCH").reduce((s, t) => s + t.amount, 0);
  const shiftRevenue = localShifts.reduce((s, t) => s + t.physicalAmount, 0);
  const shiftDone = new Set(localShifts.map((s) => s.shiftIndex)).size;
  const diffAppBranch = appRevenue - branchRevenue;
  const diffBranchShift = branchRevenue - shiftRevenue;
  const qris = channelState(localChecks, "QRIS");
  const edc = channelState(localChecks, "EDC");
  const transfer = channelState(localChecks, "TRANSFER");
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

  const summaryRows = await db
    .select({ s: dailySummaries, b: branches })
    .from(dailySummaries)
    .innerJoin(branches, eq(dailySummaries.branchId, branches.id))
    .where(inArray(dailySummaries.branchId, filteredBranches.map((b) => b.id)))
    .orderBy(asc(dailySummaries.date), asc(branches.code), asc(dailySummaries.sortKey));

  const maps = await getAggregatedSourceMaps(summaryRows.map((r) => r.s.id));
  let computed = summaryRows.map((r, i) => aggregateForSummary(r.s, r.b, maps.txns, maps.shifts, maps.checks, i + 1));

  if (opts.status && ["CLOSED", "FOLLOW_UP", "OPEN"].includes(opts.status)) {
    computed = computed.filter((r) => r.status === opts.status);
  }
  if (opts.q) {
    const q = opts.q.toLowerCase();
    computed = computed.filter((r) => `${r.branchCode} ${r.branchName} ${r.city} ${r.brand}`.toLowerCase().includes(q));
  }

  const counts = {
    total: computed.length,
    CLOSED: computed.filter((r) => r.status === "CLOSED").length,
    FOLLOW_UP: computed.filter((r) => r.status === "FOLLOW_UP").length,
    OPEN: computed.filter((r) => r.status === "OPEN").length,
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
  const [row] = await db
    .select({ s: dailySummaries, b: branches })
    .from(dailySummaries)
    .innerJoin(branches, eq(dailySummaries.branchId, branches.id))
    .where(eq(dailySummaries.id, id));
  if (!row) return null;

  const [txns, shifts, pays, excs, logs] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.summaryId, id)),
    db.select().from(shiftReports).where(eq(shiftReports.summaryId, id)),
    db.select().from(paymentChecks).where(eq(paymentChecks.summaryId, id)),
    db.select().from(exceptions).where(eq(exceptions.summaryId, id)),
    db.select().from(auditLogs).where(eq(auditLogs.summaryId, id)).orderBy(desc(auditLogs.createdAt)).limit(8),
  ]);

  const summary = aggregateForSummary(row.s, row.b, txns, shifts, pays, 1);
  return {
    summary,
    txns: txns.sort((a, b) => a.reference.localeCompare(b.reference)),
    shifts: shifts.sort((a, b) => a.shiftIndex - b.shiftIndex),
    payments: pays,
    exceptions: excs.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
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
    if (s.status !== "CLOSED") {
      totals.openVariance += Math.max(Math.abs(s.diffAppBranch), Math.abs(s.diffBranchShift));
    }
  }

  const summaryIds = overview.rows.map((r) => r.id);
  const exceptionRows = summaryIds.length
    ? await db
        .select({ e: exceptions, s: dailySummaries, b: branches })
        .from(exceptions)
        .innerJoin(dailySummaries, eq(exceptions.summaryId, dailySummaries.id))
        .innerJoin(branches, eq(dailySummaries.branchId, branches.id))
        .where(inArray(exceptions.summaryId, summaryIds))
        .orderBy(desc(exceptions.createdAt))
    : [];

  const recentLogs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(6);
  const dates = overview.rows.map((s) => s.date).sort();
  const first = dates[0] ?? "2026-09-16";
  const last = dates[dates.length - 1] ?? "2026-09-21";
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
      .filter((r) => r.e.status === "OPEN" || r.e.status === "FOLLOW_UP")
      .map((r) => ({
        id: r.e.id,
        title: r.e.title,
        severity: r.e.severity,
        summaryId: r.e.summaryId,
        branchCode: r.b.code,
      })),
    logs: recentLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}
