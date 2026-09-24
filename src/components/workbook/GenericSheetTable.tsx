"use client";

import { ArrowUpRight } from "lucide-react";
import type { SheetPayload } from "@/lib/types";
import { rp, rpSign } from "@/lib/format";
import { cn } from "./cn";
import { ChannelPill, MatchPill, SeverityPill, Skeleton, StatusPill } from "./ui";

interface Props {
  payload: SheetPayload | null;
  loading: boolean;
  title: string;
  onJump?: (summaryId: number) => void;
}

function Cell({ col, value }: { col: SheetPayload["columns"][number]; value: string | number | null }) {
  if (col.badge === "match") return <MatchPill state={String(value ?? "NONE")} />;
  if (col.badge === "status") return <StatusPill status={String(value ?? "CLOSED")} />;
  if (col.badge === "severity") return <SeverityPill sev={String(value ?? "LOW")} />;
  if (col.badge === "channel") return <ChannelPill channel={String(value ?? "CASH")} />;
  if (col.badge === "branch") {
    const str = String(value ?? "");
    const code = str.split("—")[0]?.trim() ?? str;
    return (
      <span className="font-semibold text-gray-900">
        <span className="mr-1 font-mono text-[10px] text-gray-400">{code}</span>
        {str.includes("—") && <span className="text-gray-600">{str.split("—").slice(1).join("—").trim()}</span>}
      </span>
    );
  }
  if (col.money) {
    if (value == null) return <span className="text-gray-300">—</span>;
    const n = Number(value);
    if (col.sign) {
      if (n === 0) return <span className="font-num text-gray-400">Rp0</span>;
      return <span className="font-num font-bold text-red-700">{rpSign(n)}</span>;
    }
    return <span className="font-num text-gray-700">{rp(n)}</span>;
  }
  if (col.key === "no") return <span className="font-mono text-gray-400">{value}</span>;
  return <span className="text-gray-700">{value ?? "—"}</span>;
}

export default function GenericSheetTable({ payload, loading, title, onJump }: Props) {
  const cols = payload?.columns ?? [];
  const rows = payload?.rows ?? [];

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3.5 py-2 text-xs">
        <span className="font-mono font-bold text-gray-700">
          {title} <span className="ml-1 font-normal text-gray-400">({payload ? rows.length : "…"} baris)</span>
        </span>
        {onJump && (
          <span className="hidden items-center gap-1 font-mono text-[10px] text-gray-400 sm:flex">
            <ArrowUpRight size={11} /> klik baris untuk drill-down ke Overview
          </span>
        )}
      </div>
      <div className="max-h-[430px] w-full overflow-auto">
        <table className="sheet-grid w-full border-collapse text-left text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-100 font-mono text-[10px] font-bold tracking-wider text-gray-600 uppercase">
              {loading || cols.length === 0 ? (
                <th className="px-3 py-2.5">Memuat…</th>
              ) : (
                cols.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-3 py-2.5",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {c.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[11.5px]">
            {loading &&
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={12} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-10 text-center text-gray-400">
                  Sheet kosong — tidak ada data pada periode ini.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, i) => {
                const sid = row.summaryId;
                const clickable = typeof sid === "number" && !!onJump;
                const hot =
                  row.status === "EXCEPTION" || row.status === "MISMATCH" || row.status === "OPEN";
                return (
                  <tr
                    key={i}
                    onClick={clickable ? () => onJump(Number(sid)) : undefined}
                    className={cn(
                      "transition-colors",
                      hoverClass(clickable),
                      hot && "bg-red-50/40",
                    )}
                  >
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-3 py-2",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          ["judul"].includes(c.key) && "max-w-[220px] font-semibold text-ellipsis text-gray-800",
                          ["deskripsi", "catatan"].includes(c.key) && "max-w-[280px] text-gray-500",
                        )}
                      >
                        <Cell col={c} value={row[c.key] ?? null} />
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function hoverClass(clickable: boolean) {
  return clickable ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50";
}
