import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shiftReports } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const rowId = Number(id);
    if (isNaN(rowId)) return Response.json({ error: "Invalid id" }, { status: 400 });

    const body = (await req.json()) as {
      qrisAmount?: number;
      transferAmount?: number;
      edcAmount?: number;
      cashAmount?: number;
      note?: string;
    };

    // Hitung physicalAmount dari total channel
    const [current] = await db
      .select()
      .from(shiftReports)
      .where(eq(shiftReports.id, rowId));
    if (!current) return Response.json({ error: "Row not found" }, { status: 404 });

    const qris = body.qrisAmount ?? current.qrisAmount;
    const transfer = body.transferAmount ?? current.transferAmount;
    const edc = body.edcAmount ?? current.edcAmount;
    const cash = body.cashAmount ?? current.cashAmount;
    const physical = qris + transfer + edc + cash;
    const variance = physical - current.expectedAmount;
    const status =
      variance === 0 ? "MATCH" : variance > 0 ? "OVER" : "UNDER";

    const [updated] = await db
      .update(shiftReports)
      .set({
        qrisAmount: qris,
        transferAmount: transfer,
        edcAmount: edc,
        cashAmount: cash,
        physicalAmount: physical,
        variance,
        status,
        note: body.note ?? current.note,
      })
      .where(eq(shiftReports.id, rowId))
      .returning();

    return Response.json(updated);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
