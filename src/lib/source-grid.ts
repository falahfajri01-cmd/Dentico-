import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { branches, dailySummaries, paymentChecks, shiftReports, transactions } from "@/db/schema";

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  mei: "05",
  jun: "06",
  jul: "07",
  agu: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  des: "12",
};

export function parseToIsoDate(input: string): string {
  const raw = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(raw)) {
    const [dd, mm, yy] = raw.split("/");
    return `20${yy}-${mm}-${dd}`;
  }
  const compact = raw.toLowerCase().replace(/\s+/g, " ");
  const parts = compact.split(" ");
  if (parts.length >= 2) {
    const dd = parts[0].padStart(2, "0");
    const mm = MONTH_MAP[parts[1].slice(0, 3)] ?? "09";
    const yyyy = parts[2] && /^\d{4}$/.test(parts[2]) ? parts[2] : "2026";
    return `${yyyy}-${mm}-${dd}`;
  }
  return "2026-09-21";
}

export function shiftLabelToIndex(input: string | number): number {
  if (typeof input === "number") return input;
  const s = input.toLowerCase().trim();
  if (s.includes("pagi")) return 1;
  if (s.includes("siang")) return 2;
  if (s.includes("sore")) return 3;
  const n = Number(String(input).replace(/\D/g, ""));
  return n >= 1 && n <= 3 ? n : 1;
}

export async function getBranchesForBrand(brand?: string, city?: string) {
  const all = await db.select().from(branches).orderBy(asc(branches.code));
  return all.filter((b) => (!brand || b.brand === brand) && (!city || b.city === city));
}

export async function resolveBranchForBrand(params: {
  brand?: string;
  branchCode?: string;
  city?: string;
}) {
  const pool = await getBranchesForBrand(params.brand, params.city);
  if (params.branchCode) {
    const found = pool.find((b) => b.code.toLowerCase() === params.branchCode!.toLowerCase());
    if (!found) throw new Error("Cabang tidak ditemukan pada brand aktif");
    return found;
  }
  if (pool.length === 1) return pool[0];
  throw new Error("Cabang wajib diisi karena brand aktif memiliki lebih dari satu cabang");
}

export async function findOrCreateSummary(params: {
  brand?: string;
  branchCode?: string;
  city?: string;
  date: string;
}) {
  const branch = await resolveBranchForBrand({
    brand: params.brand,
    branchCode: params.branchCode,
    city: params.city,
  });
  const iso = parseToIsoDate(params.date);

  const [existing] = await db
    .select()
    .from(dailySummaries)
    .where(and(eq(dailySummaries.branchId, branch.id), eq(dailySummaries.date, iso)));
  if (existing) return { summary: existing, branch };

  const [{ value: maxSort }] = await db.select({ value: max(dailySummaries.sortKey) }).from(dailySummaries);
  const [created] = await db
    .insert(dailySummaries)
    .values({
      branchId: branch.id,
      date: iso,
      shiftDone: 0,
      shiftTotal: 3,
      appRevenue: 0,
      branchRevenue: 0,
      shiftRevenue: 0,
      diffAppBranch: 0,
      diffBranchShift: 0,
      status: "FOLLOW_UP",
      sortKey: (maxSort ?? 0) + 1,
    })
    .returning();
  return { summary: created, branch };
}

export async function refreshSummaryFields(summaryId: number) {
  const [app, branch, shift] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${transactions.amount}),0)::int` })
      .from(transactions)
      .where(and(eq(transactions.summaryId, summaryId), eq(transactions.source, "APP"))),
    db
      .select({ total: sql<number>`coalesce(sum(${transactions.amount}),0)::int` })
      .from(transactions)
      .where(and(eq(transactions.summaryId, summaryId), eq(transactions.source, "BRANCH"))),
    db
      .select({ total: sql<number>`coalesce(sum(${shiftReports.physicalAmount}),0)::int` })
      .from(shiftReports)
      .where(eq(shiftReports.summaryId, summaryId)),
  ]);

  const checks = await db.select().from(paymentChecks).where(eq(paymentChecks.summaryId, summaryId));
  const shifts = await db.select().from(shiftReports).where(eq(shiftReports.summaryId, summaryId));
  const shiftUnique = new Set(shifts.map((s) => s.shiftIndex)).size;
  const diffAppBranch = (app[0]?.total ?? 0) - (branch[0]?.total ?? 0);
  const diffBranchShift = (branch[0]?.total ?? 0) - (shift[0]?.total ?? 0);

  const anyException = checks.some((c) => c.status === "EXCEPTION");
  const anyPending = checks.some((c) => c.status === "PENDING");
  let status: "CLOSED" | "FOLLOW_UP" | "OPEN" = "CLOSED";
  if (diffAppBranch !== 0 || diffBranchShift !== 0 || shiftUnique < 3) status = "OPEN";
  else if (anyException || anyPending) status = "FOLLOW_UP";

  const [updated] = await db
    .update(dailySummaries)
    .set({
      appRevenue: app[0]?.total ?? 0,
      branchRevenue: branch[0]?.total ?? 0,
      shiftRevenue: shift[0]?.total ?? 0,
      shiftDone: shiftUnique,
      shiftTotal: 3,
      diffAppBranch,
      diffBranchShift,
      status,
    })
    .where(eq(dailySummaries.id, summaryId))
    .returning();

  return updated;
}

export async function createSourceRows(sheet: string, body: {
  brand?: string;
  city?: string;
  rows: Array<Record<string, unknown>>;
}) {
  const results: Array<{ ok: boolean; id?: number; error?: string }> = [];

  for (const raw of body.rows) {
    try {
      const date = String(raw.tanggal ?? raw.date ?? "21 Sep 2026");
      const branchCode = String(raw.branchCode ?? raw.cabang ?? "").split("—")[0].trim() || undefined;
      const { summary } = await findOrCreateSummary({ brand: body.brand, city: body.city, branchCode, date });

      if (sheet === "shift") {
        const qris = Number(raw.qris ?? 0);
        const transfer = Number(raw.transfer ?? 0);
        const edc = Number(raw.edc ?? 0);
        const cash = Number(raw.cash ?? 0);
        const pendapatan = Number(raw.pendapatan ?? qris + transfer + edc + cash);
        const expected = Number(raw.ekspektasi ?? pendapatan);
        const variance = pendapatan - expected;
        const [created] = await db
          .insert(shiftReports)
          .values({
            summaryId: summary.id,
            shiftIndex: shiftLabelToIndex(String(raw.shift ?? "Pagi")),
            cashier: String(raw.kasir ?? "Auto Import"),
            supervisor: String(raw.spv ?? "drg. Unassigned"),
            expectedAmount: expected,
            physicalAmount: pendapatan,
            variance,
            status: variance === 0 ? "MATCH" : variance > 0 ? "OVER" : "UNDER",
            note: String(raw.note ?? ""),
            handoverAt: String(raw.handover ?? "1745").replace(":", ""),
            qrisAmount: qris,
            transferAmount: transfer,
            edcAmount: edc,
            cashAmount: cash,
          })
          .returning();
        await refreshSummaryFields(summary.id);
        results.push({ ok: true, id: created.id });
        continue;
      }

      if (sheet === "app" || sheet === "branch") {
        const [created] = await db
          .insert(transactions)
          .values({
            summaryId: summary.id,
            source: sheet === "app" ? "APP" : "BRANCH",
            reference: String(raw.ref ?? raw.reference ?? `TX-${summary.id}-${Date.now()}`),
            patientName: String(raw.pasien ?? raw.patientName ?? raw.patient ?? "—"),
            treatment: String(raw.tindakan ?? raw.treatment ?? "Manual Entry"),
            channel: String(raw.channel ?? "CASH").toUpperCase(),
            amount: Number(raw.nominal ?? raw.amount ?? 0),
            inputBy: String(raw.input ?? raw.inputBy ?? "Inline Sheet"),
            status: String(raw.status ?? "OK") === "MISMATCH" ? "MISMATCH" : "OK",
            note: String(raw.note ?? "Auto-saved spreadsheet row"),
            flagged: String(raw.status ?? "") === "MISMATCH" || String(raw.status ?? "") === "REVIEW",
          })
          .returning();
        await refreshSummaryFields(summary.id);
        results.push({ ok: true, id: created.id });
        continue;
      }

      if (sheet === "qris" || sheet === "edc" || sheet === "transfer") {
        const channel = sheet.toUpperCase();
        const [created] = await db
          .insert(paymentChecks)
          .values({
            summaryId: summary.id,
            channel: channel as "QRIS" | "EDC" | "TRANSFER",
            accountLabel:
              channel === "QRIS"
                ? "QRIS BCA"
                : channel === "EDC"
                  ? "EDC Mandiri"
                  : "TF BCA •• 8821",
            expected: Number(raw.ekspektasi ?? raw.nominal ?? 0),
            actual: raw.actual == null ? Number(raw.ekspektasi ?? raw.nominal ?? 0) : Number(raw.actual),
            status: String(raw.status ?? "MATCH") as "MATCH" | "PENDING" | "EXCEPTION" | "NONE",
            reference: String(raw.ref ?? raw.reference ?? ""),
            note: String(raw.note ?? "Auto-saved spreadsheet row"),
          })
          .returning();
        await refreshSummaryFields(summary.id);
        results.push({ ok: true, id: created.id });
        continue;
      }

      results.push({ ok: false, error: "Unsupported sheet" });
    } catch (e) {
      results.push({ ok: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return results;
}

export async function updateSourceRow(sheet: string, id: number, body: Record<string, unknown>) {
  if (sheet === "app" || sheet === "branch") {
    const [current] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!current) throw new Error("Row tidak ditemukan");
    let summaryId = current.summaryId;
    if (body.tanggal || body.cabang || body.brand || body.city) {
      const [currSummary] = await db.select().from(dailySummaries).where(eq(dailySummaries.id, current.summaryId));
      const [currBranch] = currSummary
        ? await db.select().from(branches).where(eq(branches.id, currSummary.branchId))
        : [null];
      const resolved = await findOrCreateSummary({
        brand: String(body.brand ?? currBranch?.brand ?? ""),
        city: String(body.city ?? currBranch?.city ?? ""),
        branchCode: String(body.cabang ?? currBranch?.code ?? "").split("—")[0].trim() || undefined,
        date: String(body.tanggal ?? currSummary?.date ?? "2026-09-21"),
      });
      summaryId = resolved.summary.id;
    }
    const [updated] = await db
      .update(transactions)
      .set({
        summaryId,
        reference: String(body.ref ?? current.reference),
        patientName: String(body.pasien ?? current.patientName),
        treatment: String(body.tindakan ?? current.treatment),
        channel: String(body.channel ?? current.channel).toUpperCase(),
        amount: Number(body.nominal ?? current.amount),
        inputBy: String(body.input ?? current.inputBy),
      })
      .where(eq(transactions.id, id))
      .returning();
    await Promise.all([refreshSummaryFields(current.summaryId), refreshSummaryFields(summaryId)]);
    return updated;
  }

  if (sheet === "shift") {
    const [current] = await db.select().from(shiftReports).where(eq(shiftReports.id, id));
    if (!current) throw new Error("Row tidak ditemukan");
    const qris = Number(body.qris ?? current.qrisAmount);
    const transfer = Number(body.transfer ?? current.transferAmount);
    const edc = Number(body.edc ?? current.edcAmount);
    const cash = Number(body.cash ?? current.cashAmount);
    const pendapatan = Number(body.pendapatan ?? qris + transfer + edc + cash);
    const expected = Number(body.ekspektasi ?? current.expectedAmount);
    const variance = pendapatan - expected;
    const [updated] = await db
      .update(shiftReports)
      .set({
        shiftIndex: shiftLabelToIndex(String(body.shift ?? current.shiftIndex)),
        physicalAmount: pendapatan,
        expectedAmount: expected,
        variance,
        status: variance === 0 ? "MATCH" : variance > 0 ? "OVER" : "UNDER",
        qrisAmount: qris,
        transferAmount: transfer,
        edcAmount: edc,
        cashAmount: cash,
        cashier: String(body.kasir ?? current.cashier),
        supervisor: String(body.spv ?? current.supervisor),
      })
      .where(eq(shiftReports.id, id))
      .returning();
    await refreshSummaryFields(current.summaryId);
    return updated;
  }

  if (sheet === "qris" || sheet === "edc" || sheet === "transfer") {
    const [current] = await db.select().from(paymentChecks).where(eq(paymentChecks.id, id));
    if (!current) throw new Error("Row tidak ditemukan");
    let summaryId = current.summaryId;
    if (body.tanggal || body.cabang || body.brand || body.city) {
      const [currSummary] = await db.select().from(dailySummaries).where(eq(dailySummaries.id, current.summaryId));
      const [currBranch] = currSummary
        ? await db.select().from(branches).where(eq(branches.id, currSummary.branchId))
        : [null];
      const resolved = await findOrCreateSummary({
        brand: String(body.brand ?? currBranch?.brand ?? ""),
        city: String(body.city ?? currBranch?.city ?? ""),
        branchCode: String(body.cabang ?? currBranch?.code ?? "").split("—")[0].trim() || undefined,
        date: String(body.tanggal ?? currSummary?.date ?? "2026-09-21"),
      });
      summaryId = resolved.summary.id;
    }
    const [updated] = await db
      .update(paymentChecks)
      .set({
        summaryId,
        expected: Number(body.ekspektasi ?? current.expected),
        actual: body.actual == null ? current.actual : Number(body.actual),
        reference: String(body.ref ?? current.reference),
        status: String(body.status ?? current.status) as "MATCH" | "PENDING" | "EXCEPTION" | "NONE",
        note: String(body.note ?? current.note),
      })
      .where(eq(paymentChecks.id, id))
      .returning();
    await Promise.all([refreshSummaryFields(current.summaryId), refreshSummaryFields(summaryId)]);
    return updated;
  }

  throw new Error("Unsupported sheet");
}

export async function deleteSourceRow(sheet: string, id: number) {
  if (sheet === "app" || sheet === "branch") {
    const [current] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!current) throw new Error("Row tidak ditemukan");
    await db.delete(transactions).where(eq(transactions.id, id));
    await refreshSummaryFields(current.summaryId);
    return { ok: true };
  }

  if (sheet === "shift") {
    const [current] = await db.select().from(shiftReports).where(eq(shiftReports.id, id));
    if (!current) throw new Error("Row tidak ditemukan");
    await db.delete(shiftReports).where(eq(shiftReports.id, id));
    await refreshSummaryFields(current.summaryId);
    return { ok: true };
  }

  if (sheet === "qris" || sheet === "edc" || sheet === "transfer") {
    const [current] = await db.select().from(paymentChecks).where(eq(paymentChecks.id, id));
    if (!current) throw new Error("Row tidak ditemukan");
    await db.delete(paymentChecks).where(eq(paymentChecks.id, id));
    await refreshSummaryFields(current.summaryId);
    return { ok: true };
  }

  throw new Error("Unsupported sheet");
}
