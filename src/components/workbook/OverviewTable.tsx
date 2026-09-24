"use client";

import type { SummaryPage, SummaryRow } from "@/lib/types";
import { rp, rpSign } from "@/lib/format";
import { cn } from "./cn";
import { BranchDot, MatchPill, ShiftChip, Skeleton, StatusPill } from "./ui";

interface Props {
  page: SummaryPage | null;
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onPage: (page: number) => void;
}

function DiffCell({ value, hot }: { value: number; hot: boolean }) {
  if (value === 0) {
    return <span className="font-num text-gray-400">Rp0</span>;
  }
  if (hot) {
    return (
      <span className="inline-block rounded bg-[#E53935] px-1.5 py-0.5 font-num text-[11px] font-extrabold text-white">
        {rpSign(value)}
      </span>
    );
  }
  return <span className="font-num font-bold text-[#E53935]">{rpSign(value)}</span>;
}

function Row({ r, selected, onSelect }: { r: SummaryRow; selected: boolean; onSelect: () => void }) {
  const isOpen = r.status === "OPEN";
  return (
    <tr
      onClick={onSelect}
      className={cn(
        "cursor-pointer transition-colors",
        selected ? "row-selected" : "hover:bg-gray-50",
        isOpen && !selected && "bg-red-50/40",
      )}
    >
      <td
        className={cn(
          "border-r border-gray-100 px-3 py-2 text-center font-mono",
          selected ? "bg-red-100/60 font-bold text-[#E53935]" : "bg-gray-50/50 text-gray-400",
        )}
      >
        {r.rowIndex}
      </td>
      <td className={cn("px-3 py-2 font-mono", selected ? "font-bold text-[#E53935]" : "text-gray-600")}>
        {r.dateLabel}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {!selected && <BranchDot status={r.status} />}
          <span className={cn("font-semibold", selected ? "font-extrabold text-[#E53935]" : "text-gray-900")}>
            {r.branchCode} ({r.branchName})
          </span>
          {selected && (
            <span className="rounded bg-[#E53935] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
              SELECTED
            </span>
          )}
        </div>
      </td>
      <td className="px-2.5 py-2 text-center">
        <ShiftChip done={r.shiftDone} total={r.shiftTotal} />
      </td>
      <td className="px-3 py-2 text-right">
        <span className="font-num text-gray-700">{rp(r.appRevenue)}</span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className={cn("font-num", selected ? "font-bold text-[#E53935]" : isOpen ? "font-bold text-[#E53935]" : "text-gray-700")}>
          {rp(r.branchRevenue)}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="font-num text-gray-700">{rp(r.shiftRevenue)}</span>
      </td>
      <td className={cn("px-3 py-2 text-right", r.diffAppBranch !== 0 ? "bg-red-50" : "bg-gray-50/40")}>
        <DiffCell value={r.diffAppBranch} hot={isOpen && r.diffAppBranch !== 0} />
      </td>
      <td className={cn("px-3 py-2 text-right", r.diffBranchShift !== 0 ? "bg-red-50" : "bg-gray-50/40")}>
        <DiffCell value={r.diffBranchShift} hot={false} />
      </td>
      <td className="px-2.5 py-2 text-center">
        <MatchPill state={r.qris} />
      </td>
      <td className="px-2.5 py-2 text-center">
        <MatchPill state={r.transfer} />
      </td>
      <td className="px-2.5 py-2 text-center">
        <MatchPill state={r.edc} />
      </td>
      <td className="px-3 py-2 text-center">
        <StatusPill status={r.status} ping={isOpen} />
      </td>
    </tr>
  );
}

export default function OverviewTable({ page, loading, selectedId, onSelect, onPage }: Props) {
  const rows = page?.rows ?? [];
  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  const cur = page?.page ?? 1;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="sheet-grid w-full border-collapse text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-100 font-mono text-[10px] font-bold tracking-wider text-gray-600 uppercase">
              <th className="w-12 px-3 py-2.5 text-center text-gray-400">#</th>
              <th className="px-3 py-2.5">Tanggal</th>
              <th className="px-3 py-2.5">Cabang</th>
              <th className="px-2.5 py-2.5 text-center">Shift</th>
              <th className="px-3 py-2.5 text-right">App Revenue</th>
              <th className="px-3 py-2.5 text-right">Branch Revenue</th>
              <th className="px-3 py-2.5 text-right">Shift Revenue</th>
              <th className="bg-gray-50/80 px-3 py-2.5 text-right">App − Branch</th>
              <th className="bg-gray-50/80 px-3 py-2.5 text-right">Branch − Shift</th>
              <th className="px-2.5 py-2.5 text-center">QRIS</th>
              <th className="px-2.5 py-2.5 text-center">Transfer</th>
              <th className="px-2.5 py-2.5 text-center">EDC</th>
              <th className="px-3 py-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[11.5px]">
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={13} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-gray-400">
                  Tidak ada baris yang cocok dengan filter saat ini.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <Row key={r.id} r={r} selected={r.id === selectedId} onSelect={() => onSelect(r.id)} />
              ))}
          </tbody>
        </table>
      </div>

      {/* Footer pagination */}
      <div className="flex flex-col items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3.5 py-2 font-mono text-xs text-gray-500 sm:flex-row">
        <div className="flex items-center gap-2">
          <span>
            Rows: <strong className="text-gray-800">{page ? Math.min(rows.length, page.pageSize) : 0} of {page?.total ?? 0}</strong>{" "}
            Cabang Loaded
          </span>
          <span className="text-gray-300">|</span>
          <span
            className={cn(
              "font-bold",
              page && page.counts.OPEN > 0 ? "text-[#E53935]" : "text-emerald-600",
            )}
          >
            {page?.counts.OPEN ?? 0} Open Variance
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-emerald-600">{page?.counts.CLOSED ?? 0} Closed</span>
        </div>
        <div className="flex items-center gap-1 font-sans">
          <button
            disabled={cur <= 1}
            onClick={() => onPage(cur - 1)}
            className={cn(
              "rounded border px-2 py-0.5 text-[11px]",
              cur <= 1
                ? "cursor-not-allowed border-gray-300 bg-white text-gray-300"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100",
            )}
          >
            Prev
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => onPage(i + 1)}
              className={cn(
                "rounded px-2.5 py-0.5 text-[11px] font-bold",
                cur === i + 1
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100",
              )}
            >
              {i + 1}
            </button>
          ))}
          <button
            disabled={cur >= totalPages}
            onClick={() => onPage(cur + 1)}
            className={cn(
              "rounded border px-2 py-0.5 text-[11px]",
              cur >= totalPages
                ? "cursor-not-allowed border-gray-300 bg-white text-gray-300"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100",
            )}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
