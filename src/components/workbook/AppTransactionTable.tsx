"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Plus, Search } from "lucide-react";
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

type SaveState = "idle" | "saving" | "saved" | "error";
type Row = Record<string, string | number | null> & { id?: number; summaryId?: number };
const TIMES = ["21:06:24", "20:09:30", "19:28:16", "18:45:10", "17:12:05", "14:02:18", "11:30:42", "09:15:00"];
const SHIFTS = ["Sore", "Sore", "Sore", "Sore", "Siang", "Siang", "Pagi", "Pagi"];

function parsePaste(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((v) => v.trim()))
    .filter((row) => row.some(Boolean));
}

export default function AppTransactionTable({
  payload,
  loading,
  onJump,
  activeBrand,
  activeCity,
  activeBranchCode,
  onSourceChanged,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [saveState, setSaveState] = useState<Record<number, SaveState>>({});
  const [bulkInfo, setBulkInfo] = useState<string>("");
  const debounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setRows(payload?.rows ?? []);
  }, [payload]);

  const activeBranchLabel = useMemo(() => activeBranchCode || "ikuti row / auto-resolve", [activeBranchCode]);

  async function patchRow(id: number, row: Row) {
    setSaveState((s) => ({ ...s, [id]: "saving" }));
    try {
      await fetch(`/api/source-grid/app/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: activeBrand,
          city: activeCity,
          tanggal: row.tanggal,
          cabang: row.cabang,
          ref: row.ref,
          pasien: row.pasien,
          nominal: Number(row.nominal ?? 0),
          channel: row.channel,
          input: row.input,
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

  function schedulePatch(index: number) {
    const row = rows[index];
    const id = Number(row.id);
    if (!id) return;
    clearTimeout(debounceRef.current[id]);
    debounceRef.current[id] = setTimeout(() => void patchRow(id, row), 450);
  }

  function updateCell(index: number, key: string, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  async function addRow() {
    await fetch(`/api/source-grid/app`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: activeBrand,
        city: activeCity,
        rows: [
          {
            tanggal: "21 Sep 2026",
            cabang: activeBranchCode,
            ref: `TX-NEW-${Date.now()}`,
            pasien: "",
            nominal: 0,
            channel: "CASH",
            input: "Inline Grid",
            tindakan: "Manual Entry",
          },
        ],
      }),
    });
    await onSourceChanged?.();
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, startKey: string) {
    const text = e.clipboardData.getData("text/plain");
    const grid = parsePaste(text);
    if (grid.length <= 1 && grid[0]?.length <= 1) return;
    e.preventDefault();
    const startCols = ["tanggal", "ref", "pasien", "nominal", "cabang", "channel"];
    const startPos = startCols.indexOf(startKey);
    const prepared = grid.map((cols) => ({
      tanggal: cols[startPos + 0] || rows[rowIndex]?.tanggal || "21 Sep 2026",
      ref: cols[startPos + 1] || `TX-PASTE-${Date.now()}`,
      pasien: cols[startPos + 2] || "",
      nominal: Number((cols[startPos + 3] || "0").replace(/\D/g, "")),
      cabang: cols[startPos + 4] || activeBranchCode,
      channel: (cols[startPos + 5] || "CASH").toUpperCase(),
      input: "Clipboard Paste",
      tindakan: "Bulk Paste",
    }));

    setBulkInfo(`${prepared.length} rows detected — auto-saving...`);
    await fetch(`/api/source-grid/app`, {
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Ny. Ratna Permata" className="h-10 w-full rounded-xl border border-gray-200 bg-white pr-3 pl-9 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300" />
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-[#E53935]">
            Active Brand: {activeBrand || "Semua Brand"} 🔒
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] text-gray-600">
            Cabang default: <strong>{activeBranchLabel}</strong>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bulkInfo && <span className="text-[11px] font-semibold text-emerald-600">{bulkInfo}</span>}
          <button onClick={addRow} className="flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-700 hover:bg-blue-100">
            <Plus size={14} /> Baris Baru
          </button>
          <button className="flex h-10 items-center gap-2 rounded-xl bg-gray-900 px-4 text-xs font-bold text-white hover:bg-black">
            <Download size={14} /> Ekspor XLSX
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/30">
          <div className="flex items-center gap-3">
            <FileText className="text-[#E53935]" size={18} />
            <h3 className="text-sm font-extrabold text-gray-900">App Transaction Raw Data</h3>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Ctrl+V multi-row didukung</span>
          </div>
          <div className="text-[10px] font-bold uppercase text-gray-400">Auto-saved</div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-[10px] font-bold tracking-wider text-gray-500 uppercase">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jam</th>
                <th className="px-4 py-3">TT Transaction ID</th>
                <th className="px-4 py-3">Pasien</th>
                <th className="px-4 py-3 text-right">Pendapatan</th>
                <th className="px-4 py-3 text-center">Cabang</th>
                <th className="px-4 py-3 text-center">Shift</th>
                <th className="px-4 py-3 text-center">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
              ))}
              {!loading && rows.map((r, i) => {
                const isHot = r.status === "MISMATCH" || r.status === "REVIEW";
                const time = TIMES[i % TIMES.length];
                const shift = SHIFTS[i % SHIFTS.length];
                const sv = saveState[Number(r.id)] ?? "idle";
                return (
                  <tr key={Number(r.id) || i} className={cn(isHot ? "bg-red-50/50" : "hover:bg-gray-50", "transition-colors")}>
                    <td className="px-4 py-2">
                      <input value={`${r.tanggal}`} onChange={(e) => updateCell(i, "tanggal", e.target.value)} onBlur={() => schedulePatch(i)} onPaste={(e) => handlePaste(e, i, "tanggal")} className="w-full rounded px-1 py-1 font-semibold text-gray-700 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-gray-500">{time}</td>
                    <td className="px-4 py-2">
                      <input value={String(r.ref ?? "")} onChange={(e) => updateCell(i, "ref", e.target.value)} onBlur={() => schedulePatch(i)} onPaste={(e) => handlePaste(e, i, "ref")} className="w-full rounded px-1 py-1 font-mono font-extrabold text-gray-900 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input value={String(r.pasien ?? "")} onChange={(e) => updateCell(i, "pasien", e.target.value)} onBlur={() => schedulePatch(i)} onPaste={(e) => handlePaste(e, i, "pasien")} placeholder="—" className="w-full rounded px-1 py-1 font-semibold text-gray-900 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                        {isHot && <span className="rounded bg-[#E53935] px-1.5 py-0.5 text-[8px] font-extrabold text-white">AUDIT</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input value={String(Number(r.nominal ?? 0).toLocaleString("id-ID"))} onChange={(e) => updateCell(i, "nominal", e.target.value.replace(/\D/g, ""))} onBlur={() => schedulePatch(i)} onPaste={(e) => handlePaste(e, i, "nominal")} className="w-28 rounded px-1 py-1 text-right font-num font-bold text-gray-700 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input value={String(r.cabang ?? activeBranchCode)} onChange={(e) => updateCell(i, "cabang", e.target.value)} onBlur={() => schedulePatch(i)} onPaste={(e) => handlePaste(e, i, "cabang")} className="w-24 rounded px-1 py-1 text-center font-bold text-gray-700 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" />
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500">{shift}</td>
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
