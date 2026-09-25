"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Plus } from "lucide-react";
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

export default function EdcTable({ payload, loading, activeBrand, activeCity, activeBranchCode, onSourceChanged }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
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
  function schedule(index: number) { const row = rows[index]; if (!row?.id) return; clearTimeout(timers.current[Number(row.id)]); timers.current[Number(row.id)] = setTimeout(() => void patch(index), 400); }
  async function addRow() {
    const branchRows = payload?.rows.filter(r => r.branchCode === activeBranchCode) ?? [];
    const summaryId = Number(branchRows[0]?.summaryId ?? 0);
    await createPaymentCheck({
      summary_id: summaryId,
      channel: 'EDC',
      account_label: 'EDC Mandiri',
      expected: 0,
      actual: null,
      status: 'MATCH',
      reference: '',
      note: 'Auto-saved spreadsheet row',
    });
    await onSourceChanged?.();
  }

  return <section className="flex flex-col gap-4 fade-slide"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-[#E53935]">Active Brand: {activeBrand || "Semua Brand"} 🔒</div></div><button onClick={addRow} className="flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-700 hover:bg-blue-100"><Plus size={14} /> Baris Baru</button></div><div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div className="flex items-center gap-2"><CreditCard className="text-[#E53935]" size={16} /><h3 className="font-bold text-gray-900">EDC Settlement Ledger</h3></div><span className="text-[10px] font-bold text-gray-400 uppercase">Auto-saved</span></div><div className="w-full overflow-x-auto"><table className="w-full border-collapse text-left text-[12px] whitespace-nowrap"><thead><tr className="border-b border-gray-200 bg-gray-50/30 text-[10px] font-bold tracking-wider text-gray-500 uppercase"><th className="px-5 py-3.5">Tanggal</th><th className="px-4 py-3.5 text-center">Cabang</th><th className="px-4 py-3.5 text-right">Nominal</th><th className="px-4 py-3.5">Reference</th><th className="px-4 py-3.5 text-right">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{loading && Array.from({length:5}).map((_,i)=><tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>)}{!loading && rows.map((r,i)=><tr key={Number(r.id)||i} className="hover:bg-gray-50"><td className="px-5 py-2"><input value={String(r.tanggal ?? "")} onChange={(e)=>updateCell(i,"tanggal",e.target.value)} className="w-full rounded p-1 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" /></td><td className="px-4 py-2 text-center"><input value={String(r.cabang ?? "")} onChange={(e)=>updateCell(i,"cabang",e.target.value)} className="w-full rounded p-1 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" /></td><td className="px-4 py-2 text-right"><input value={r.ekspektasi ? Number(r.ekspektasi).toLocaleString("id-ID") : ""} onChange={(e)=>{const v=e.target.value.replace(/\D/g,"");updateCell(i,"ekspektasi",v);schedule(i);}} className="w-full rounded p-1 text-right font-num outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" /></td><td className="px-4 py-2"><input value={String(r.ref ?? "")} onChange={(e)=>updateCell(i,"ref",e.target.value)} onBlur={()=>schedule(i)} className="w-full rounded p-1 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300" /></td><td className="px-4 py-2 text-right"><select value={String(r.status ?? "MATCH")} onChange={(e)=>updateCell(i,"status",e.target.value)} onBlur={()=>schedule(i)} className="rounded p-1 outline-none hover:bg-blue-50 focus:bg-white focus:ring-1 focus:ring-blue-300"><option>MATCH</option><option>PENDING</option><option>EXCEPTION</option><option>NONE</option></select></td></tr>)}</tbody></table></div></div></section>;
}