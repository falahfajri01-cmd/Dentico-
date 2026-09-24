import { getMeta } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const meta = await getMeta({
      brand: url.searchParams.get("brand") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      branchCode: url.searchParams.get("branch") ?? undefined,
    });
    return Response.json(meta);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Gagal memuat meta workbook" }, { status: 500 });
  }
}
