import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, dailySummaries, exceptions, paymentChecks, shiftReports, transactions } from "@/db/schema";
import { getDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

function digest(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `0x${(h >>> 0).toString(16).padStart(8, "0")}${((h ^ 0xabcdef) >>> 0).toString(16).padStart(8, "0")}`.slice(0, 18);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const detail = await getDetail(Number(id));
    if (!detail) return Response.json({ error: "Summary tidak ditemukan" }, { status: 404 });
    return Response.json(detail);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Gagal memuat detail" }, { status: 500 });
  }
}

/**
 * PATCH — aksi controller:
 *  { action: "resolve" }  -> tandai selesai + kunci sheet + tambah audit log
 *  { action: "note", note } -> tambah catatan audit manual
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const summaryId = Number(id);
    const body = (await req.json()) as { action?: string; note?: string };

    const [summary] = await db.select().from(dailySummaries).where(eq(dailySummaries.id, summaryId));
    if (!summary) return Response.json({ error: "Summary tidak ditemukan" }, { status: 404 });

    const [last] = await db.select().from(auditLogs).orderBy(auditLogs.id).offset(0);

    if (body.action === "resolve") {
      await db
        .update(exceptions)
        .set({ status: "RESOLVED" })
        .where(eq(exceptions.summaryId, summaryId));
      await db
        .update(dailySummaries)
        .set({ status: "CLOSED" })
        .where(eq(dailySummaries.id, summaryId));
      const prevHash = last?.hash ?? digest("genesis-dentico");
      await db.insert(auditLogs).values({
        summaryId,
        action: "RESOLVED_CLOSED",
        actor: "Siti Rahmawati",
        role: "Finance Controller",
        detail:
          "Selisih diverifikasi controller — penyesuaian dicatat di Reconciliation, exception ditutup & sheet dikunci.",
        hash: digest(`${prevHash}RESOLVED_CLOSED${summaryId}${Date.now()}`),
        prevHash,
        verified: true,
      });
    } else if (body.action === "note" && body.note) {
      const prevHash = last?.hash ?? digest("genesis-dentico");
      await db.insert(auditLogs).values({
        summaryId,
        action: "CONTROLLER_NOTE",
        actor: "Siti Rahmawati",
        role: "Finance Controller",
        detail: body.note.slice(0, 400),
        hash: digest(`${prevHash}NOTE${summaryId}${Date.now()}`),
        prevHash,
        verified: true,
      });
    } else if (body.action === "reopen") {
      await db.update(dailySummaries).set({ status: "OPEN" }).where(eq(dailySummaries.id, summaryId));
    } else {
      return Response.json({ error: "Aksi tidak dikenal" }, { status: 400 });
    }

    const detail = await getDetail(summaryId);
    void transactions;
    void shiftReports;
    void paymentChecks;
    return Response.json(detail);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Gagal menjalankan aksi" }, { status: 500 });
  }
}
