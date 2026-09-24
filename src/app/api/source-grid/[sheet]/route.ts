import { createSourceRows } from "@/lib/source-grid";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ sheet: string }> },
) {
  try {
    const { sheet } = await ctx.params;
    const body = (await req.json()) as {
      brand?: string;
      city?: string;
      rows?: Array<Record<string, unknown>>;
    };
    const results = await createSourceRows(sheet, {
      brand: body.brand,
      city: body.city,
      rows: body.rows ?? [],
    });
    return Response.json({ results });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Gagal membuat rows" }, { status: 500 });
  }
}
