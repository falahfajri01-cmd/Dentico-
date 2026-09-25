"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BranchDto,
  DailySheetId,
  MetaDto,
  PlaceholderView,
  SheetPayload,
  SummaryDetail,
  SummaryPage,
  WorkbookView,
} from "@/lib/types";
import { rp } from "@/lib/format";
import AuditPanel from "./AuditPanel";
import AppTransactionTable from "./AppTransactionTable";
import BranchSpreadsheetTable from "./BranchSpreadsheetTable";
import EdcTable from "./EdcTable";
import EmptyFeature from "./EmptyFeature";
import FilterBar from "./FilterBar";
import GenericSheetTable from "./GenericSheetTable";
import Inspector from "./Inspector";
import OverviewTable from "./OverviewTable";
import QrisTable from "./QrisTable";
import SheetTabs, { TABS } from "./SheetTabs";
import ShiftReportTable from "./ShiftReportTable";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import TransferTable from "./TransferTable";
import { listSummaries, getMeta, getDetail, buildSheet, resolveSummary, addNote, reopenSummary, updateShiftReport } from "@/lib/queries";

const PAGE_SIZE = 8;
const DAILY_VIEWS: DailySheetId[] = ["overview", "shift", "app", "branch", "qris", "edc", "transfer"];

function isDaily(v: WorkbookView): v is DailySheetId {
  return (DAILY_VIEWS as string[]).includes(v);
}
function isPlaceholder(v: WorkbookView): v is PlaceholderView {
  return !isDaily(v);
}

export default function Workbook() {
  const [meta, setMeta] = useState<MetaDto | null>(null);
  const [pageData, setPageData] = useState<SummaryPage | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [view, setView] = useState<WorkbookView>("overview");
  const [sheetPayload, setSheetPayload] = useState<SheetPayload | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SummaryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);

  // Global brand workspace context
  const [qRaw, setQRaw] = useState("");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [city, setCity] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [status, setStatus] = useState("");
  const [pageNo, setPageNo] = useState(1);

  const auditRef = useRef<HTMLDivElement>(null);
  const dailyView: DailySheetId = isDaily(view) ? view : "overview";

  // persistent active brand context
  useEffect(() => {
    const savedBrand = window.localStorage.getItem("dentico.activeBrand") ?? "";
    const savedCity = window.localStorage.getItem("dentico.activeCity") ?? "";
    const savedBranch = window.localStorage.getItem("dentico.activeBranch") ?? "";
    setBrand(savedBrand);
    setCity(savedCity);
    setBranchCode(savedBranch);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dentico.activeBrand", brand);
  }, [brand]);
  useEffect(() => {
    window.localStorage.setItem("dentico.activeCity", city);
  }, [city]);
  useEffect(() => {
    window.localStorage.setItem("dentico.activeBranch", branchCode);
  }, [branchCode]);

  const qs = useCallback(() => {
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    if (city) params.set("city", city);
    if (branchCode) params.set("branch", branchCode);
    return params;
  }, [brand, city, branchCode]);

  /* ---------------- fetchers ---------------- */
  const fetchMeta = useCallback(async () => {
    const params = qs();
    const data = await getMeta({
      brand: params.get("brand") ?? undefined,
      city: params.get("city") ?? undefined,
      branchCode: params.get("branch") ?? undefined,
    });
    setMeta(data);
  }, [qs]);

  const fetchSummaries = useCallback(
    async (selectMode: "preserve" | "firstOpen" = "preserve") => {
      setLoadingPage(true);
      try {
        const params = qs();
        const data = await listSummaries({
          status: status || undefined,
          q: q || undefined,
          brand: params.get("brand") ?? undefined,
          city: params.get("city") ?? undefined,
          branchCode: params.get("branch") ?? undefined,
          page: pageNo,
          pageSize: PAGE_SIZE,
        });
        setPageData(data);
        if (selectMode === "firstOpen" && data.rows.length > 0) {
          const openRow = data.rows.find((r) => r.status === "OPEN") ?? data.rows[0];
          setSelectedId(openRow.id);
        }
      } finally {
        setLoadingPage(false);
      }
    },
    [pageNo, status, q, qs],
  );

  const fetchDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    try {
      const data = await getDetail(id);
      if (data) setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const fetchSheet = useCallback(async (sheet: DailySheetId) => {
    if (sheet === "overview") return;
    setLoadingSheet(true);
    try {
      const params = qs();
      const data = await buildSheet(sheet, {
        brand: params.get("brand") ?? undefined,
        city: params.get("city") ?? undefined,
        branchCode: params.get("branch") ?? undefined,
      });
      if (data) setSheetPayload(data);
    } finally {
      setLoadingSheet(false);
    }
  }, [qs]);

  const refreshAfterSourceChange = useCallback(async () => {
    await Promise.all([fetchMeta(), fetchSummaries(), selectedId != null ? fetchDetail(selectedId) : Promise.resolve()]);
    if (dailyView !== "overview") await fetchSheet(dailyView);
  }, [fetchMeta, fetchSummaries, fetchDetail, selectedId, dailyView, fetchSheet]);

  /* ---------------- effects ---------------- */
  useEffect(() => {
    void fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qRaw);
      setPageNo(1);
    }, 250);
    return () => clearTimeout(t);
  }, [qRaw]);

  useEffect(() => {
    void fetchSummaries("firstOpen");
  }, [fetchSummaries]);

  useEffect(() => {
    if (selectedId != null) void fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  useEffect(() => {
    if (isDaily(view) && view !== "overview") void fetchSheet(view);
  }, [view, fetchSheet]);

  /* ---------------- actions ---------------- */
  const runAction = useCallback(
    async (action: "resolve" | "note" | "reopen", note?: string) => {
      if (selectedId == null) return;
      setBusy(true);
      try {
        if (action === "resolve") {
          await resolveSummary(selectedId);
        } else if (action === "note" && note) {
          await addNote(selectedId, note);
        } else if (action === "reopen") {
          await reopenSummary(selectedId);
        }
        await refreshAfterSourceChange();
      } finally {
        setBusy(false);
      }
    },
    [selectedId, refreshAfterSourceChange],
  );

  const handleShiftReportChange = useCallback(
    async (rowId: number, data: { qrisAmount?: number; transferAmount?: number; edcAmount?: number; cashAmount?: number; note?: string }) => {
      setBusy(true);
      try {
        await updateShiftReport(rowId, data);
        await refreshAfterSourceChange();
      } finally {
        setBusy(false);
      }
    },
    [refreshAfterSourceChange],
  );

  const jumpToSummary = useCallback((summaryId: number) => {
    setView("overview");
    setStatus("");
    setPageNo(1);
    setSelectedId(summaryId);
    auditRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleNavigate = useCallback((v: WorkbookView) => {
    setView(v);
    setPageNo(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ---------------- export CSV ---------------- */
  const exportCsv = useCallback(() => {
    if (!isDaily(view)) return;
    let name = `dentico_${view}`;
    let lines: string[] = [];
    if (view === "overview" && pageData) {
      lines = [
        ["#", "Tanggal", "Cabang", "Shift", "App Revenue", "Branch Revenue", "Shift Revenue", "App-Branch", "Branch-Shift", "QRIS", "Transfer", "EDC", "Status"].join(";"),
        ...pageData.rows.map((r) =>
          [
            r.rowIndex,
            r.date,
            `${r.branchCode} (${r.branchName})`,
            `${r.shiftDone}/${r.shiftTotal}`,
            r.appRevenue,
            r.branchRevenue,
            r.shiftRevenue,
            r.diffAppBranch,
            r.diffBranchShift,
            r.qris,
            r.transfer,
            r.edc,
            r.status,
          ].join(";"),
        ),
      ];
    } else if (sheetPayload) {
      lines = [
        sheetPayload.columns.map((c) => c.label).join(";"),
        ...sheetPayload.rows.map((row) => sheetPayload.columns.map((c) => String(row[c.key] ?? "")).join(";")),
      ];
    }
    if (lines.length === 0) return;
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [view, pageData, sheetPayload]);

  /* ---------------- derived ---------------- */
  const counts = pageData?.counts ?? meta?.counts ?? { total: 0, CLOSED: 0, FOLLOW_UP: 0, OPEN: 0 };
  const auditLogs = detail && selectedId != null && detail.logs.length > 0 ? detail.logs : (meta?.logs ?? []);
  const auditContext = detail && selectedId != null ? `sel ${detail.summary.cellRef} • ${detail.summary.branchCode} ${detail.summary.dateLabel}` : "workbook global";

  const brandScopedCities = useMemo(() => {
    const branches = meta?.branches ?? [];
    return [...new Set(branches.filter((b) => !brand || b.brand === brand).map((b) => b.city))];
  }, [meta?.branches, brand]);

  const brandCityScopedBranches = useMemo(() => {
    const branches = meta?.branches ?? [];
    return branches.filter((b) => (!brand || b.brand === brand) && (!city || b.city === city));
  }, [meta?.branches, brand, city]);

  useEffect(() => {
    if (!brand && meta?.brands?.length) setBrand(meta.brands[0]);
  }, [meta?.brands, brand]);

  useEffect(() => {
    if (brandCityScopedBranches.length === 1 && !branchCode) {
      setBranchCode(brandCityScopedBranches[0].code);
    }
  }, [brandCityScopedBranches, branchCode]);

  /* ---------------- render ---------------- */
  return (
    <div className="min-h-screen">
      <Sidebar active={view} onNavigate={handleNavigate} />

      <div className="flex min-h-screen flex-col pl-64">
        <Topbar search={qRaw} onSearch={setQRaw} meta={meta} onAlertClick={jumpToSummary} />

        <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-3.5 px-5 pt-20 pb-6">
          {isPlaceholder(view) ? (
            <EmptyFeature view={view} onBack={() => setView("overview")} />
          ) : (
            <>
              <SheetTabs active={dailyView} onChange={(s) => setView(s)} meta={meta} onExport={exportCsv} />

              {dailyView === "overview" && (
                <FilterBar
                  q={qRaw}
                  onQ={setQRaw}
                  brand={brand}
                  onBrand={(v) => {
                    setBrand(v);
                    setCity("");
                    setBranchCode("");
                    setPageNo(1);
                  }}
                  city={city}
                  onCity={(v) => {
                    setCity(v);
                    setBranchCode("");
                    setPageNo(1);
                  }}
                  branchCode={branchCode}
                  onBranchCode={(v) => {
                    setBranchCode(v);
                    setPageNo(1);
                  }}
                  brands={meta?.brands ?? []}
                  cities={brandScopedCities}
                  branches={brandCityScopedBranches}
                  status={status}
                  onStatus={(v) => {
                    setStatus(v);
                    setPageNo(1);
                  }}
                  counts={counts}
                />
              )}

              {dailyView === "overview" ? (
                <OverviewTable page={pageData} loading={loadingPage} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} onPage={(p) => setPageNo(p)} />
              ) : dailyView === "shift" ? (
                <ShiftReportTable
                  payload={sheetPayload}
                  loading={loadingSheet}
                  onJump={jumpToSummary}
                  activeBrand={brand}
                  activeCity={city}
                  activeBranchCode={branchCode}
                  onSourceChanged={refreshAfterSourceChange}
                  onRowChange={handleShiftReportChange}
                />
              ) : dailyView === "app" ? (
                <AppTransactionTable
                  payload={sheetPayload}
                  loading={loadingSheet}
                  onJump={jumpToSummary}
                  activeBrand={brand}
                  activeCity={city}
                  activeBranchCode={branchCode}
                  onSourceChanged={refreshAfterSourceChange}
                />
              ) : dailyView === "branch" ? (
                <BranchSpreadsheetTable
                  payload={sheetPayload}
                  loading={loadingSheet}
                  onJump={jumpToSummary}
                  activeBrand={brand}
                  activeCity={city}
                  activeBranchCode={branchCode}
                  onSourceChanged={refreshAfterSourceChange}
                />
              ) : dailyView === "qris" ? (
                <QrisTable
                  payload={sheetPayload}
                  loading={loadingSheet}
                  onJump={jumpToSummary}
                  activeBrand={brand}
                  activeCity={city}
                  activeBranchCode={branchCode}
                  onSourceChanged={refreshAfterSourceChange}
                />
              ) : dailyView === "edc" ? (
                <EdcTable
                  payload={sheetPayload}
                  loading={loadingSheet}
                  onJump={jumpToSummary}
                  activeBrand={brand}
                  activeCity={city}
                  activeBranchCode={branchCode}
                  onSourceChanged={refreshAfterSourceChange}
                />
              ) : dailyView === "transfer" ? (
                <TransferTable
                  payload={sheetPayload}
                  loading={loadingSheet}
                  onJump={jumpToSummary}
                  activeBrand={brand}
                  activeCity={city}
                  activeBranchCode={branchCode}
                  onSourceChanged={refreshAfterSourceChange}
                />
              ) : (
                <GenericSheetTable
                  payload={sheetPayload}
                  loading={loadingSheet}
                  title={TABS.find((t) => t.id === dailyView)?.label ?? ""}
                  onJump={jumpToSummary}
                />
              )}

              {dailyView === "overview" && (
                <div ref={auditRef} className="grid scroll-mt-20 grid-cols-1 gap-4 pb-2 xl:grid-cols-12">
                  <Inspector detail={detail} loading={loadingDetail} busy={busy} onAction={runAction} />
                  <AuditPanel logs={auditLogs} loading={loadingDetail && selectedId != null} contextLabel={auditContext} />
                </div>
              )}

              {dailyView !== "overview" && (
                <div className="fade-slide flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 shadow-sm">
                  <span>
                    Workspace aktif: <strong className="text-[#E53935]">{brand || "Semua Brand"}</strong>
                    {city ? <> · Kota <strong className="text-gray-800">{city}</strong></> : null}
                    {branchCode ? <> · Cabang <strong className="text-gray-800">{branchCode}</strong></> : null}
                  </span>
                  <span className="font-mono text-[10px] text-gray-400">
                    total varian terbuka: <strong className="text-[#E53935]">{meta ? rp(meta.totals.openVariance) : "…"}</strong>
                  </span>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}