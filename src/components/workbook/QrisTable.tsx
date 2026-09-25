"use client";

import { useEffect, useRef, useState } from "react";
import { Filter, Plus, QrCode } from "lucide-react";
import type { SheetPayload } from "@/lib/types";
import { Skeleton } from "./ui";
import { updatePaymentCheck, createPaymentCheck } from "@/lib/queries";

interface Props {
  payload: SheetPayload | null;
  loading: boolean;
  onJump?: (summaryId: number) => void;
  activeBrand: string;
  activeCity: string;
  activeBranchCode: string;
  onSourceChanged?: () => void | Promise<void>;
}

type Row = Record<string, string | number | null> & { id?: number; summaryId?: number };

export default function QrisTable({ payload, loading, activeBrand, activeCity, activeBranchCode, onSourceChanged }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [bulkInfo, setBulkInfo] = useState("");
  const timerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  useEffect(() => setRows(payload?.rows ?? []), [payload]);

  function updateCell(index: number, key: string, value: string) {
    setRows((prev) => { const next = [...prev]; next[index] = { ...next[index], [key]: value }; return next; });
  }

  async function patch(index: number) {
    const row = rows[index];
    if (!row?.id) return;
    await updatePaymentCheck(Number(row.id), {
      expected: Number(row.ekspektasi ?? 0),
      actual: row.actual === "" ? null : Number(row.actual ?? 0),
      reference: String(row.ref ?? ""),
      status: String(row.status ?? "MATCH"),
    });
    await onSourceChanged?.();
  }

  function schedule(index: number) {
    const row = rows[index];
    if (!row?.id) return;
    clearTimeout(timerRef.current[Number(row.id)]);
    timerRef.current[Number(row.id)] = setTimeout(() => void patch(index), 400);
  }

  async function addRow() {
    const branchRows = payload?.rows.filter(r => r.branchCode === activeBranchCode) ?? [];
    const summaryId = Number(branchRows[0]?.summaryId ?? 0);
    await createPaymentCheck({
      summary_id: summaryId,
      channel: 'QRIS',
      account_label: 'QRIS BCA',
      expected: 0,
      actual: null,
      status: 'MATCH',
      reference: '',
      note: 'Auto-saved spreadsheet row',
    });
    await onSourceChanged?.();
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text/plain");
    const grid = text.trim().split(/\r?\n/).map((l) => l.split("\t").map((v) => v.trim())).filter((r) => r.some(Boolean));
    if (grid.length <= 1 && grid[0]?.length <= 1) return;
    e.preventDefault();
    const branchRows = payload?.rows.filter(r => r.branchCode === activeBranchCode) ?? [];
    const summaryId = Number(branchRows[0]?.summaryId ?? 0);
    const prepared = grid.map((cols) => ({
      summary_id: summaryId,
      channel: 'QRIS' as const,
      account_label: 'QRIS BCA',
      expected: Number((cols[2] || "0").replace(/\D/g, "")),
      actual: Number((cols[2] || "0").replace(/\D/g, "")),
      reference: cols[3] || "",
      status: cols[4] || "MATCH",
      note: 'Auto-saved spreadsheet row',
    }));
    setBulkInfo(`${prepared.length} rows detected — auto-saving...`);
    await Promise.all(prepared.map(p => createPaymentCheck(p)));
    setBulkInfo(`${prepared.length} rows saved`);
    setTimeout(() => setBulkInfo(""), 1800);
    await onSourceChanged?.();
  }

  return (
    <section className="flex flex-col gap-4 fade-slide">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-72"><Filter size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Filter Cabang..." className="h-10 w-full rounded-xl border border-gray-200 bg-white pr-3 pl-9 text-xs outline-none focus:ring-1 focus:ring-gray-300" /></div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-[#E53935]">Active Brand: {activeBrand || "Semua Brand"} 🔒</div>
          {bulkInfo && <span className="text-[11px] font-semibold text-emerald-600">{bulkInfo}</span>}
        </div>
        <button onClick={addRow} className="flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-700 hover:bg-blue-100"><Plus size={14} /> Baris Baru</button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div className="flex items-center gap-2"><QrCode className="text-[#E53935]" size={16} /><h3 className="font-bold text-gray-900">QRIS Digital Spreadsheet</h3></div><span className="text-[10px] font-bold text-gray-400 uppercase">Auto-saved</span></div>
        <div className="w-full overflow-x-auto"><table className="w-full border-collapse text-left text-[12px] whitespace-nowrap"><thead><tr className="border-b border-gray-200 bg-gray-50/30 text-xs font-semibold text-gray-500"><th className="px-5 py-3.5">Tanggal</th><th className="px-4 py-3.5">Cabang</th><th className="px-4 py-3.5 text-right">Nominal</th><th className="px-4 py-3.5">RRN / Ref</th><th className="px-4 py-3.5 text-center">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{loading && Array.from({length:5}).map((_,i)=><tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>)}{!loading && rows.map((r,i)=><tr key={Number(r.id)||i} className="hover:bg-gray-50"><td className="px-5 py-2"><input value={String(r.tanggal ?? "")} onChange={(e)=>updateCell(i,"tanggal",e.target.value)} className="w-full rounded p-1 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" /></td><td className="px-4 py-2"><input value={String(r.cabang ?? activeBranchCode)} onChange={(e)=>updateCell(i,"cabang",e.target.value)} className="w-full rounded p-1 font-semibold text-gray-700 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" /></td><td className="px-4 py-2 text-right"><input value={String(Number(r.ekspektasi ?? 0).toLocaleString("id-ID"))} onChange={(e)=>updateCell(i,"ekspektasi",e.target.value.replace(/\D/g,""))} onBlur={()=>schedule(i)} onPaste={handlePaste} className="w-28 rounded p-1 text-right font-num font-bold outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" /></td><td className="px-4 py-2"><input value={String(r.ref ?? "")} onChange={(e)=>updateCell(i,"ref",e.target.value)} onBlur={()=>schedule(i)} className="w-full rounded p-1 font-mono text-[11px] outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" /></td><td className="px-4 py-2 text-center"><select value={String(r.status ?? "MATCH")} onChange={(e)=>updateCell(i,"status",e.target.value)} onBlur={()=>schedule(i)} className="rounded p-1 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300"><option>MATCH</option><option>PENDING</option><option>EXCEPTION</option><option>NONE</option></select></td></tr>)}</tbody></table></div></div></section>
  );
}