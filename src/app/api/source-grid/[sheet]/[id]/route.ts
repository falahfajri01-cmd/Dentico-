import { deleteSourceRow, updateSourceRow } from "@/lib/source-grid";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ sheet: string; id: string }> },
) {
  try {
    const { sheet, id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const updated = await updateSourceRow(sheet, Number(id), body);
    return Response.json(updated);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : "Gagal update row" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ sheet: string; id: string }> },
) {
  try {
    const { sheet, id } = await ctx.params;
    const deleted = await deleteSourceRow(sheet, Number(id));
    return Response.json(deleted);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : "Gagal hapus row" }, { status: 500 });
  }
}
