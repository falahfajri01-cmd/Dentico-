import { listSummaries } from "@/lib/queries";
import type { SummaryPage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "8") || 8));
    const result: SummaryPage = await listSummaries({
      status: url.searchParams.get("status") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      brand: url.searchParams.get("brand") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      branchCode: url.searchParams.get("branch") ?? undefined,
      page,
      pageSize,
    });
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Gagal memuat summary" }, { status: 500 });
  }
}
