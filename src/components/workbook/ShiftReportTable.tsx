"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCcw,
} from "lucide-react";
import type { SheetPayload } from "@/lib/types";
import { cn } from "./cn";
import { Skeleton } from "./ui";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  payload: SheetPayload | null;
  loading: boolean;
  onJump?: (summaryId: number) => void;
  activeBrand: string;
  activeCity: string;
  activeBranchCode: string;
  onSourceChanged?: () => void | Promise<void>;
}

interface ShiftRow {
  id: number;
  summaryId: number;
  tanggal: string;
  branchCode: string;
  branchName: string;
  shift: number;
  kasir: string;
  spv: string;
  pendapatan: number;
  qris: number;
  transfer: number;
  edc: number;
  cash: number;
  ekspektasi: number;
  selisih: number;
  status: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/* ------------------------------------------------------------------ */
/* Inline editable money cell                                          */
/* ------------------------------------------------------------------ */

function MoneyCell({
  value,
  onChange,
  onSave,
  hot = false,
  onPaste,
}: {
  value: number;
  onChange: (v: number) => void;
  onSave: () => void;
  hot?: boolean;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    if (!editing) setRaw(String(value));
  }, [value, editing]);

  const commit = () => {
    const parsed = Number(raw.replace(/\D/g, ""));
    onChange(isNaN(parsed) ? value : parsed);
    setEditing(false);
    onSave();
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onPaste={onPaste}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") commit();
          if (e.key === "Escape") { setEditing(false); setRaw(String(value)); }
        }}
        className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-right font-num text-xs font-bold text-blue-700 outline-none ring-2 ring-blue-100"
      />
    );
  }

  return (
    <span
      onClick={() => { setEditing(true); setRaw(String(value)); }}
      title="Klik untuk mengedit"
      className={cn(
        "block w-full cursor-text rounded px-2 py-1 text-right font-num text-xs font-semibold transition-colors hover:bg-blue-50",
        value === 0 ? "text-gray-300" : hot ? "text-[#E53935] font-bold" : "text-gray-800",
      )}
    >
      {value === 0 ? "—" : value.toLocaleString("id-ID")}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Paste helper                                                        */
/* ------------------------------------------------------------------ */

function parsePaste(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split("\t").map((v) => v.trim()))
    .filter((r) => r.some(Boolean));
}

/* ================================================================== */
/* Main component                                                      */
/* ================================================================== */

export default function ShiftReportTable({
  payload,
  loading,
  activeBrand,
  activeCity,
  activeBranchCode,
  onSourceChanged,
}: Props) {
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [saveState, setSaveState] = useState<Record<number, SaveState>>({});
  const [bulkInfo, setBulkInfo] = useState("");
  const debounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  /* Load payload */
  useEffect(() => {
    if (payload?.rows) {
      setRows(
        (payload.rows as unknown as ShiftRow[]).map((r) => ({
          ...r,
          id: Number(r.id),
          summaryId: Number(r.summaryId),
          shift: Number(r.shift),
          pendapatan: Number(r.pendapatan),
          qris: Number(r.qris),
          transfer: Number(r.transfer),
          edc: Number(r.edc),
          cash: Number(r.cash),
          ekspektasi: Number(r.ekspektasi),
          selisih: Number(r.selisih),
        })),
      );
    }
  }, [payload]);

  /* Auto-recalculate pendapatan dari channel */
  const updateChannel = useCallback(
    (rowIdx: number, field: "qris" | "transfer" | "edc" | "cash", val: number) => {
      setRows((prev) => {
        const next = [...prev];
        const row = { ...next[rowIdx], [field]: val };
        row.pendapatan = row.qris + row.transfer + row.edc + row.cash;
        row.selisih = row.pendapatan - row.ekspektasi;
        row.status = row.selisih === 0 ? "MATCH" : row.selisih > 0 ? "OVER" : "UNDER";
        next[rowIdx] = row;
        return next;
      });
    },
    [],
  );

  /* Auto-save PATCH */
  async function patchRow(id: number, row: ShiftRow) {
    setSaveState((p) => ({ ...p, [id]: "saving" }));
    try {
      await fetch(`/api/source-grid/shift/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qris: row.qris,
          transfer: row.transfer,
          edc: row.edc,
          cash: row.cash,
          pendapatan: row.pendapatan,
          ekspektasi: row.ekspektasi,
          shift: row.shift,
        }),
      });
      setSaveState((p) => ({ ...p, [id]: "saved" }));
      setTimeout(() => setSaveState((p) => ({ ...p, [id]: "idle" })), 1400);
      await onSourceChanged?.();
    } catch {
      setSaveState((p) => ({ ...p, [id]: "error" }));
    }
  }

  const scheduleSave = useCallback(
    (rowId: number, rowIdx: number) => {
      setSaveState((p) => ({ ...p, [rowId]: "saving" }));
      clearTimeout(debounceRef.current[rowId]);
      debounceRef.current[rowId] = setTimeout(() => {
        const row = rows[rowIdx];
        if (row) void patchRow(rowId, row);
      }, 450);
    },
    [rows],
  );

  /* Add single empty row */
  async function addRow() {
    await fetch(`/api/source-grid/shift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: activeBrand,
        city: activeCity,
        rows: [
          {
            tanggal: "21 Sep 2026",
            cabang: activeBranchCode,
            shift: "Pagi",
            pendapatan: 0,
            qris: 0,
            transfer: 0,
            edc: 0,
            cash: 0,
          },
        ],
      }),
    });
    await onSourceChanged?.();
  }

  /* Bulk paste handler */
  async function handlePaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    _field: "qris" | "transfer" | "edc" | "cash",
  ) {
    const text = e.clipboardData.getData("text/plain");
    const grid = parsePaste(text);
    if (grid.length <= 1 && grid[0]?.length <= 1) return;
    e.preventDefault();
    const prepared = grid.map((cols) => ({
      tanggal: cols[0] || "21 Sep 2026",
      cabang: cols[1] || activeBranchCode,
      shift: cols[2] || "Pagi",
      pendapatan: Number((cols[3] || "0").replace(/\D/g, "")),
      qris: Number((cols[4] || "0").replace(/\D/g, "")),
      transfer: Number((cols[5] || "0").replace(/\D/g, "")),
      edc: Number((cols[6] || "0").replace(/\D/g, "")),
      cash: Number((cols[7] || "0").replace(/\D/g, "")),
    }));
    setBulkInfo(`${prepared.length} baris terdeteksi — menyimpan...`);
    await fetch(`/api/source-grid/shift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: activeBrand, city: activeCity, rows: prepared }),
    });
    setBulkInfo(`${prepared.length} baris tersimpan`);
    setTimeout(() => setBulkInfo(""), 1800);
    await onSourceChanged?.();
  }

  /* Totals */
  const totalPendapatan = rows.reduce((s, r) => s + r.pendapatan, 0);
  const totalQris = rows.reduce((s, r) => s + r.qris, 0);
  const totalTransfer = rows.reduce((s, r) => s + r.transfer, 0);
  const totalEdc = rows.reduce((s, r) => s + r.edc, 0);
  const totalCash = rows.reduce((s, r) => s + r.cash, 0);

  /* ================================================================ */
  /* Render                                                           */
  /* ================================================================ */
  return (
    <section className="flex flex-col gap-4 fade-slide">

      {/* ── Top action bar — sama struktur dengan AppTransactionTable ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* FX formula hint */}
          <div className="flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 font-mono text-[11px] text-gray-600">
            <span className="font-extrabold text-[#E53935]">FX</span>
            <span className="text-gray-400">ƒx</span>
            <span className="ml-1 text-gray-500">
              =SHIFT_RECONCILE(Brand, Cabang, Tanggal, Channel)
            </span>
          </div>

          {/* Active Brand lock */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-[11px] font-bold text-[#E53935]">
            Active Brand: <span className="ml-0.5">{activeBrand || "Semua Brand"}</span>
            <span className="ml-0.5 opacity-60">🔒</span>
          </div>

          {/* Live feed badge */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700">
            <Clock size={12} />
            Live Feed: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
          </div>

          {bulkInfo && (
            <span className="text-[11px] font-semibold text-emerald-600">{bulkInfo}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <Plus size={13} /> Baris Baru
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <RefreshCcw size={13} /> Auto-sync
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-4 text-xs font-bold text-white hover:bg-black">
            <Download size={13} /> Ekspor
          </button>
        </div>
      </div>

      {/* ── Data table container — konsisten dengan tab lain ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* Sub-header tabel */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-[#E53935]" size={18} />
            <h3 className="text-sm font-extrabold text-gray-900">Daily Shift Reconciliation Sheet</h3>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              {rows.length} dari 45 log shift terverifikasi
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-gray-400">
            Klik sel untuk mengedit · tersimpan otomatis
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px] whitespace-nowrap">

            {/* ── Column headers — tema putih konsisten ── */}
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-bold tracking-wider text-gray-500 uppercase">
                <th className="px-4 py-3.5">
                  <span className="flex items-center gap-1.5">
                    Tanggal <ChevronDown size={11} className="text-gray-300" />
                  </span>
                </th>
                <th className="px-4 py-3.5">
                  <span className="flex items-center gap-1.5">
                    Cabang <ChevronDown size={11} className="text-gray-300" />
                  </span>
                </th>
                <th className="px-4 py-3.5">
                  <span className="flex items-center gap-1.5">
                    Shift <ChevronDown size={11} className="text-gray-300" />
                  </span>
                </th>
                <th className="border-l border-gray-100 px-4 py-3.5 text-right">
                  <span className="flex items-center justify-end gap-1">
                    <span className="text-gray-300">#</span> Pendapatan <ChevronDown size={11} className="text-gray-300" />
                  </span>
                </th>
                <th className="border-l border-gray-100 px-4 py-3.5 text-right">
                  <span className="flex items-center justify-end gap-1">
                    <span className="text-gray-300">#</span> QRIS <ChevronDown size={11} className="text-gray-300" />
                  </span>
                </th>
                <th className="border-l border-gray-100 px-4 py-3.5 text-right">
                  <span className="flex items-center justify-end gap-1">
                    <span className="text-gray-300">#</span> Transfer <ChevronDown size={11} className="text-gray-300" />
                  </span>
                </th>
                <th className="border-l border-gray-100 px-4 py-3.5 text-right">
                  <span className="flex items-center justify-end gap-1">
                    <span className="text-gray-300">#</span> EDC <ChevronDown size={11} className="text-gray-300" />
                  </span>
                </th>
                <th className="border-l border-gray-100 px-4 py-3.5 text-right">
                  <span className="flex items-center justify-end gap-1">
                    <span className="text-gray-300">#</span> Cash <ChevronDown size={11} className="text-gray-300" />
                  </span>
                </th>
                <th className="border-l border-gray-100 px-4 py-3.5 text-center">Status</th>
              </tr>
            </thead>

            {/* ── Rows ── */}
            <tbody className="divide-y divide-gray-100">
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="p-3">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                rows.map((row, i) => {
                  const sv = saveState[row.id] ?? "idle";
                  const isHot = row.status !== "MATCH";

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors",
                        isHot ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-gray-50",
                      )}
                    >
                      {/* Tanggal */}
                      <td className="px-4 py-2.5 font-mono text-[11.5px] text-gray-600 whitespace-nowrap">
                        {row.tanggal}
                      </td>

                      {/* Cabang */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-white",
                              isHot ? "bg-[#E53935]" : "bg-gray-500",
                            )}
                          >
                            {row.branchCode}
                          </span>
                          <span className="text-[11px] text-gray-500">{row.branchName}</span>
                        </div>
                      </td>

                      {/* Shift */}
                      <td className="px-4 py-2.5">
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 font-mono text-[10px] font-bold text-gray-700">
                          Shift {row.shift}
                        </span>
                      </td>

                      {/* Pendapatan — read-only auto sum */}
                      <td className="border-l border-gray-100 px-4 py-2.5 text-right">
                        <span
                          className={cn(
                            "font-num text-xs font-extrabold",
                            isHot ? "text-[#E53935]" : "text-gray-900",
                          )}
                        >
                          {row.pendapatan === 0 ? "—" : row.pendapatan.toLocaleString("id-ID")}
                        </span>
                      </td>

                      {/* QRIS — editable */}
                      <td className="border-l border-gray-100 px-2 py-2">
                        <MoneyCell
                          value={row.qris}
                          onChange={(v) => updateChannel(i, "qris", v)}
                          onSave={() => scheduleSave(row.id, i)}
                          onPaste={(e) => handlePaste(e, "qris")}
                        />
                      </td>

                      {/* Transfer — editable */}
                      <td className="border-l border-gray-100 px-2 py-2">
                        <MoneyCell
                          value={row.transfer}
                          onChange={(v) => updateChannel(i, "transfer", v)}
                          onSave={() => scheduleSave(row.id, i)}
                          onPaste={(e) => handlePaste(e, "transfer")}
                        />
                      </td>

                      {/* EDC — editable */}
                      <td className="border-l border-gray-100 px-2 py-2">
                        <MoneyCell
                          value={row.edc}
                          onChange={(v) => updateChannel(i, "edc", v)}
                          onSave={() => scheduleSave(row.id, i)}
                          onPaste={(e) => handlePaste(e, "edc")}
                        />
                      </td>

                      {/* Cash — editable */}
                      <td className="border-l border-gray-100 px-2 py-2">
                        <MoneyCell
                          value={row.cash}
                          onChange={(v) => updateChannel(i, "cash", v)}
                          onSave={() => scheduleSave(row.id, i)}
                          onPaste={(e) => handlePaste(e, "cash")}
                        />
                      </td>

                      {/* Status + save indicator */}
                      <td className="border-l border-gray-100 px-4 py-2.5 text-center">
                        {sv === "saving" ? (
                          <Loader2 size={14} className="mx-auto animate-spin text-blue-400" />
                        ) : sv === "saved" ? (
                          <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600">
                            <CheckCircle2 size={13} /> Saved
                          </span>
                        ) : sv === "error" ? (
                          <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-red-500">
                            <AlertCircle size={13} /> Error
                          </span>
                        ) : row.status === "MATCH" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[9.5px] font-extrabold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> MATCH
                          </span>
                        ) : row.status === "OVER" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#E53935] px-2.5 py-0.5 text-[9.5px] font-extrabold text-white">
                            +{Math.abs(row.selisih).toLocaleString("id-ID")}
                          </span>
                        ) : row.status === "UNDER" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[9.5px] font-extrabold text-white">
                            −{Math.abs(row.selisih).toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[9.5px] font-extrabold text-gray-500">
                            PENDING
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>

            {/* ── Totals footer row ── */}
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-300 bg-gray-50 text-[11px] font-bold text-gray-700">
                  <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-gray-400" colSpan={3}>
                    TOTAL PERIODE
                  </td>
                  <td className="border-l border-gray-200 px-4 py-3 text-right font-num font-extrabold text-gray-900">
                    {totalPendapatan.toLocaleString("id-ID")}
                  </td>
                  <td className="border-l border-gray-200 px-4 py-3 text-right font-num font-bold text-sky-700">
                    {totalQris.toLocaleString("id-ID")}
                  </td>
                  <td className="border-l border-gray-200 px-4 py-3 text-right font-num font-bold text-teal-700">
                    {totalTransfer.toLocaleString("id-ID")}
                  </td>
                  <td className="border-l border-gray-200 px-4 py-3 text-right font-num font-bold text-violet-700">
                    {totalEdc.toLocaleString("id-ID")}
                  </td>
                  <td className="border-l border-gray-200 px-4 py-3 text-right font-num font-bold text-amber-700">
                    {totalCash.toLocaleString("id-ID")}
                  </td>
                  <td className="border-l border-gray-200 px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </section>
  );
}
