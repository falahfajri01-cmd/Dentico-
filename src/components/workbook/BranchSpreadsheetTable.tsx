"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Plus, RefreshCcw, Table2 } from "lucide-react";
import type { SheetPayload } from "@/lib/types";
import { cn } from "./cn";
import { Skeleton } from "./ui";

interface Props {
  payload: SheetPayload | null;
  loading: boolean;
  onJump?: (summaryId: number) => void;
  activeBrand: string;
  activeCity: string;
  activeBranchCode: string;
  onSourceChanged?: () => void | Promise<void>;
}

type Row = Record<string, string | number | null> & { id?: number };
type SaveState = "idle" | "saving" | "saved" | "error";

function parsePaste(text: string) {
  return text.trim().split(/\r?\n/).map((l) => l.split("\t").map((v) => v.trim())).filter((r) => r.some(Boolean));
}

export default function BranchSpreadsheetTable({ payload, loading, activeBrand, activeCity, activeBranchCode, onSourceChanged }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [saveState, setSaveState] = useState<Record<number, SaveState>>({});
  const [bulkInfo, setBulkInfo] = useState("");
  const debounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setRows(payload?.rows ?? []);
  }, [payload]);

  async function patchRow(id: number, row: Row) {
    setSaveState((s) => ({ ...s, [id]: "saving" }));
    try {
      await fetch(`/api/source-grid/branch/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: activeBrand,
          city: activeCity,
          tanggal: row.tanggal,
          cabang: row.cabang,
          pasien: row.pasien,
          nominal: Number(row.nominal ?? 0),
          channel: row.channel,
          ref: row.ref,
          tindakan: row.tindakan,
        }),
      });
      setSaveState((s) => ({ ...s, [id]: "saved" }));
      setTimeout(() => setSaveState((s) => ({ ...s, [id]: "idle" })), 1500);
      await onSourceChanged?.();
    } catch {
      setSaveState((s) => ({ ...s, [id]: "error" }));
    }
  }

  function updateCell(index: number, key: string, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function schedulePatch(index: number) {
    const row = rows[index];
    const id = Number(row.id);
    if (!id) return;
    clearTimeout(debounceRef.current[id]);
    debounceRef.current[id] = setTimeout(() => void patchRow(id, row), 450);
  }

  async function addRow() {
    await fetch(`/api/source-grid/branch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: activeBrand,
        city: activeCity,
        rows: [{ tanggal: "21 Sep 2026", cabang: activeBranchCode, pasien: "", nominal: 0, channel: "CASH", tindakan: "Manual Entry" }],
      }),
    });
    await onSourceChanged?.();
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startKey: string) {
    const grid = parsePaste(e.clipboardData.getData("text/plain"));
    if (grid.length <= 1 && grid[0]?.length <= 1) return;
    e.preventDefault();
    const prepared = grid.map((cols) => ({
      tanggal: cols[0] || "21 Sep 2026",
      pasien: cols[1] || "",
      nominal: Number((cols[2] || "0").replace(/\D/g, "")),
      cabang: cols[3] || activeBranchCode,
      channel: (cols[4] || "CASH").toUpperCase(),
      tindakan: "Bulk Paste",
      ref: `${startKey}-${Date.now()}`,
    }));
    setBulkInfo(`${prepared.length} rows detected — auto-saving...`);
    await fetch(`/api/source-grid/branch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: activeBrand, city: activeCity, rows: prepared }),
    });
    setBulkInfo(`${prepared.length} rows saved`);
    setTimeout(() => setBulkInfo(""), 1800);
    await onSourceChanged?.();
  }

  return (
    <section className="flex flex-col gap-4 fade-slide">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 items-center gap-2 rounded-lg bg-red-50 px-3 text-xs font-bold text-[#E53935] shadow-sm">
            <Table2 size={14} /> Active Brand: {activeBrand || "Semua Brand"} 🔒
          </div>
          <button onClick={addRow} className="flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-700 hover:bg-blue-100">
            <Plus size={14} /> Baris Baru
          </button>
          {bulkInfo && <span className="text-[11px] font-semibold text-emerald-600">{bulkInfo}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"><RefreshCcw size={13} /> Auto</button>
          <button className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"><Download size={13} /> Export CSV</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/20 text-xs font-semibold text-gray-600">
                <th className="px-5 py-4 w-40">Tanggal</th>
                <th className="px-4 py-4">Nama Pasien</th>
                <th className="px-4 py-4 text-right">Uang Diterima (Rp)</th>
                <th className="px-4 py-4 text-center">Cabang</th>
                <th className="px-4 py-4 text-center">Metode</th>
                <th className="px-4 py-4 text-center">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>)}
              {!loading && rows.map((r, i) => {
                const isHot = r.status === "MISMATCH" || r.status === "REVIEW";
                const sv = saveState[Number(r.id)] ?? "idle";
                return (
                  <tr key={Number(r.id) || i} className={cn(isHot ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-blue-50/20", "transition-colors")}>
                    <td className="px-5 py-2">
                      <input value={`${r.tanggal}`} onChange={(e) => updateCell(i, "tanggal", e.target.value)} onBlur={() => schedulePatch(i)} onPaste={(e) => handlePaste(e, "tanggal")} className="w-full rounded p-1.5 font-semibold text-gray-700 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input value={String(r.pasien ?? "")} onChange={(e) => updateCell(i, "pasien", e.target.value)} onBlur={() => schedulePatch(i)} placeholder="Masukkan Nama Pasien..." className="w-full rounded p-1.5 text-gray-900 font-extrabold outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                        {isHot && <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[8px] font-black text-red-600 uppercase">Audit</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input value={String(Number(r.nominal ?? 0).toLocaleString("id-ID"))} onChange={(e) => updateCell(i, "nominal", e.target.value.replace(/\D/g, ""))} onBlur={() => schedulePatch(i)} onPaste={(e) => handlePaste(e, "nominal")} className="w-32 rounded p-1.5 text-right font-num font-black text-gray-800 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 font-bold uppercase">
                      <input value={String(r.cabang ?? activeBranchCode)} onChange={(e) => updateCell(i, "cabang", e.target.value)} onBlur={() => schedulePatch(i)} className="w-24 rounded p-1.5 text-center font-bold text-gray-700 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <select value={String(r.channel ?? "CASH")} onChange={(e) => { updateCell(i, "channel", e.target.value); schedulePatch(i); }} className="rounded-lg px-2 py-1 text-[10px] font-black text-gray-700 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300">
                        <option value="CASH">TUNAI</option>
                        <option value="QRIS">QRIS</option>
                        <option value="EDC">EDC</option>
                        <option value="TRANSFER">TRANSFER</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center text-[10px] font-bold">
                      {sv === "saving" && <span className="text-blue-500">Saving...</span>}
                      {sv === "saved" && <span className="text-emerald-600">✓ Saved</span>}
                      {sv === "error" && <span className="text-red-500">Failed</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
