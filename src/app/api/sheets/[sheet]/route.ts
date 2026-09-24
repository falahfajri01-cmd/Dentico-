import { asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { branches, dailySummaries, exceptions, paymentChecks, shiftReports, transactions } from "@/db/schema";
import { seeded } from "@/lib/queries";
import { dateShort } from "@/lib/format";
import type { SheetPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

type Col = SheetPayload["columns"][number];

export async function GET(req: Request, ctx: { params: Promise<{ sheet: string }> }) {
  try {
    const { sheet } = await ctx.params;
    const url = new URL(req.url);
    await seeded();
    const payload = await buildSheet(sheet, {
      brand: url.searchParams.get("brand") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      branchCode: url.searchParams.get("branch") ?? undefined,
    });
    if (!payload) return Response.json({ error: "Sheet tidak dikenal" }, { status: 404 });
    return Response.json(payload);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Gagal memuat sheet" }, { status: 500 });
  }
}

const NO_COL: Col = { key: "no", label: "#", align: "center" };

async function buildSheet(
  sheet: string,
  filters: { brand?: string; city?: string; branchCode?: string },
): Promise<SheetPayload | null> {
  switch (sheet) {
    case "shift": {
      const rows = (await db
        .select({ r: shiftReports, s: dailySummaries, b: branches })
        .from(shiftReports)
        .innerJoin(dailySummaries, eq(shiftReports.summaryId, dailySummaries.id))
        .innerJoin(branches, eq(dailySummaries.branchId, branches.id))
        .orderBy(asc(dailySummaries.sortKey), asc(shiftReports.shiftIndex)))
        .filter((x) => (!filters.brand || x.b.brand === filters.brand) && (!filters.city || x.b.city === filters.city) && (!filters.branchCode || x.b.code === filters.branchCode));
      return {
        sheet: "shift",
        columns: [
          { key: "tanggal", label: "Tanggal" },
          { key: "cabang", label: "Cabang" },
          { key: "shift", label: "Shift" },
          { key: "pendapatan", label: "# Pendapatan" },
          { key: "qris", label: "# QRIS" },
          { key: "transfer", label: "# Transfer" },
          { key: "edc", label: "# EDC" },
          { key: "cash", label: "# Cash" },
        ],
        rows: rows.map((r) => ({
          id: r.r.id,
          summaryId: r.s.id,
          tanggal: dateShort(r.s.date),
          cabang: `${r.b.code} — ${r.b.name}`,
          branchCode: r.b.code,
          branchName: r.b.name,
          shift: r.r.shiftIndex,
          kasir: r.r.cashier,
          spv: r.r.supervisor,
          pendapatan: r.r.physicalAmount,
          qris: r.r.qrisAmount,
          transfer: r.r.transferAmount,
          edc: r.r.edcAmount,
          cash: r.r.cashAmount,
          ekspektasi: r.r.expectedAmount,
          selisih: r.r.variance,
          status: r.r.status,
        })),
      };
    }
    case "app":
    case "branch": {
      const source = sheet === "app" ? "APP" : "BRANCH";
      const rows = (await db
        .select({ t: transactions, s: dailySummaries, b: branches })
        .from(transactions)
        .innerJoin(dailySummaries, eq(transactions.summaryId, dailySummaries.id))
        .innerJoin(branches, eq(dailySummaries.branchId, branches.id))
        .where(eq(transactions.source, source))
        .orderBy(asc(dailySummaries.sortKey), asc(transactions.id)))
        .filter((x) => (!filters.brand || x.b.brand === filters.brand) && (!filters.city || x.b.city === filters.city) && (!filters.branchCode || x.b.code === filters.branchCode));
      return {
        sheet: sheet as SheetPayload["sheet"],
        columns: [
          NO_COL,
          { key: "ref", label: sheet === "app" ? "Ref Transaksi" : "Sel Sheet" },
          { key: "tanggal", label: "Tanggal" },
          { key: "cabang", label: "Cabang", badge: "branch" },
          { key: "pasien", label: "Pasien" },
          { key: "tindakan", label: "Tindakan" },
          { key: "channel", label: "Channel", align: "center", badge: "channel" },
          { key: "input", label: "Diinput Oleh" },
          { key: "nominal", label: "Nominal", align: "right", money: true },
          { key: "status", label: "Validasi", align: "center", badge: "match" },
        ],
        rows: rows.map((r, i) => ({
          id: r.t.id,
          no: i + 1,
          summaryId: r.s.id,
          ref: r.t.reference,
          tanggal: dateShort(r.s.date),
          cabang: `${r.b.code} — ${r.b.name}`,
          pasien: r.t.patientName,
          tindakan: r.t.treatment,
          channel: r.t.channel,
          input: r.t.inputBy,
          nominal: r.t.amount,
          status: r.t.status === "MISMATCH" ? "MISMATCH" : r.t.flagged ? "REVIEW" : "MATCH",
        })),
      };
    }
    case "qris":
    case "edc":
    case "transfer": {
      const channel = sheet.toUpperCase();
      const rows = (await db
        .select({ p: paymentChecks, s: dailySummaries, b: branches })
        .from(paymentChecks)
        .innerJoin(dailySummaries, eq(paymentChecks.summaryId, dailySummaries.id))
        .innerJoin(branches, eq(dailySummaries.branchId, branches.id))
        .where(eq(paymentChecks.channel, channel))
        .orderBy(asc(dailySummaries.sortKey)))
        .filter((x) => (!filters.brand || x.b.brand === filters.brand) && (!filters.city || x.b.city === filters.city) && (!filters.branchCode || x.b.code === filters.branchCode));
      return {
        sheet: sheet as SheetPayload["sheet"],
        columns: [
          NO_COL,
          { key: "tanggal", label: "Tanggal" },
          { key: "cabang", label: "Cabang", badge: "branch" },
          { key: "akun", label: "Akun Settlement" },
          { key: "ekspektasi", label: "Ekspektasi (App)", align: "right", money: true },
          { key: "settlement", label: "Mutasi Bank", align: "right", money: true },
          { key: "selisih", label: "Selisih", align: "right", money: true, sign: true },
          { key: "ref", label: "Ref Settlement" },
          { key: "status", label: "Status", align: "center", badge: "match" },
          { key: "catatan", label: "Catatan" },
        ],
        rows: rows.map((r, i) => ({
          id: r.p.id,
          no: i + 1,
          summaryId: r.s.id,
          tanggal: dateShort(r.s.date),
          cabang: `${r.b.code} — ${r.b.name}`,
          akun: r.p.accountLabel,
          ekspektasi: r.p.expected,
          settlement: r.p.actual,
          selisih: r.p.actual == null ? null : r.p.actual - r.p.expected,
          ref: r.p.reference || "—",
          status: r.p.status,
          catatan: r.p.note || "—",
        })),
      };
    }
    case "recon": {
      const rows = await db
        .select({ s: dailySummaries, b: branches })
        .from(dailySummaries)
        .innerJoin(branches, eq(dailySummaries.branchId, branches.id))
        .where(
          or(
            sql`${dailySummaries.diffAppBranch} != 0`,
            sql`${dailySummaries.diffBranchShift} != 0`,
            sql`${dailySummaries.status} != 'CLOSED'`,
          ),
        )
        .orderBy(asc(dailySummaries.sortKey));
      return {
        sheet: "recon",
        columns: [
          NO_COL,
          { key: "tanggal", label: "Tanggal" },
          { key: "cabang", label: "Cabang", badge: "branch" },
          { key: "app", label: "App Revenue", align: "right", money: true },
          { key: "cab", label: "Branch Revenue", align: "right", money: true },
          { key: "shf", label: "Shift Revenue", align: "right", money: true },
          { key: "d1", label: "Δ App−Cabang", align: "right", money: true, sign: true },
          { key: "d2", label: "Δ Cabang−Shift", align: "right", money: true, sign: true },
          { key: "status", label: "Status", align: "center", badge: "status" },
        ],
        rows: rows.map((r, i) => ({
          no: i + 1,
          summaryId: r.s.id,
          tanggal: dateShort(r.s.date),
          cabang: `${r.b.code} — ${r.b.name}`,
          app: r.s.appRevenue,
          cab: r.s.branchRevenue,
          shf: r.s.shiftRevenue,
          d1: r.s.diffAppBranch,
          d2: r.s.diffBranchShift,
          status: r.s.status,
        })),
      };
    }
    case "exception": {
      const rows = await db
        .select({ e: exceptions, s: dailySummaries, b: branches })
        .from(exceptions)
        .innerJoin(dailySummaries, eq(exceptions.summaryId, dailySummaries.id))
        .innerJoin(branches, eq(dailySummaries.branchId, branches.id))
        .orderBy(desc(exceptions.createdAt));
      return {
        sheet: "exception",
        columns: [
          NO_COL,
          { key: "sev", label: "Severity", align: "center", badge: "severity" },
          { key: "tanggal", label: "Tanggal" },
          { key: "cabang", label: "Cabang", badge: "branch" },
          { key: "judul", label: "Temuan" },
          { key: "deskripsi", label: "Detail" },
          { key: "owner", label: "Owner" },
          { key: "selisih", label: "Nominal Varian", align: "right", money: true, sign: true },
          { key: "status", label: "Status", align: "center", badge: "status" },
        ],
        rows: rows.map((r, i) => ({
          no: i + 1,
          id: r.e.id,
          summaryId: r.s.id,
          sev: r.e.severity,
          tanggal: dateShort(r.s.date),
          cabang: `${r.b.code} — ${r.b.name}`,
          judul: r.e.title,
          deskripsi: r.e.description,
          owner: r.e.owner,
          selisih: Math.max(Math.abs(r.s.diffAppBranch), Math.abs(r.s.diffBranchShift)) * -1 || null,
          status: r.e.status,
        })),
      };
    }
    default:
      return null;
  }
}
