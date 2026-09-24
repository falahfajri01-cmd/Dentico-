"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/workbook/cn";

/* ---------- Badge status summary (CLOSED / FOLLOW_UP / OPEN) ---------- */

export function StatusPill({ status, ping = false }: { status: string; ping?: boolean }) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10.5px] font-extrabold text-white shadow-sm shadow-red-200">
        <span className={cn("h-1.5 w-1.5 rounded-full bg-white", ping && "pulse-dot")} /> OPEN
      </span>
    );
  }
  if (status === "FOLLOW_UP") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> FOLLOW UP
      </span>
    );
  }
  if (status === "RESOLVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> RESOLVED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> CLOSED
    </span>
  );
}

/* ---------- Badge kecil MATCH / PENDING / EXCEPTION / NONE dll ---------- */

export function MatchPill({ state }: { state: string }) {
  const map: Record<string, string> = {
    MATCH: "border-emerald-200 bg-emerald-50 text-emerald-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    EXCEPTION: "border-red-300 bg-red-100 text-red-700",
    MISMATCH: "border-red-300 bg-red-100 text-red-700",
    REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
    OVER: "border-red-300 bg-red-100 text-red-700",
    UNDER: "border-red-300 bg-red-100 text-red-700",
  };
  const cls = map[state];
  if (!cls) {
    if (state === "NONE") {
      return <span className="text-gray-300">—</span>;
    }
    return (
      <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[9.5px] font-bold text-gray-500">
        {state}
      </span>
    );
  }
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[9.5px] font-bold", cls)}>{state}</span>
  );
}

/* ---------- Severity ---------- */

export function SeverityPill({ sev }: { sev: string }) {
  const map: Record<string, string> = {
    HIGH: "bg-red-600 text-white",
    MEDIUM: "bg-amber-100 text-amber-800 border border-amber-200",
    LOW: "bg-gray-100 text-gray-600 border border-gray-200",
  };
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wide", map[sev] ?? map.LOW)}>
      {sev}
    </span>
  );
}

/* ---------- Channel ---------- */

export function ChannelPill({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    QRIS: "bg-sky-50 text-sky-700 border-sky-200",
    EDC: "bg-violet-50 text-violet-700 border-violet-200",
    TRANSFER: "bg-teal-50 text-teal-700 border-teal-200",
    CASH: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[9.5px] font-bold", map[channel] ?? map.CASH)}>
      {channel}
    </span>
  );
}

/* ---------- Shift x/3 chip ---------- */

export function ShiftChip({ done, total }: { done: number; total: number }) {
  const full = done >= total;
  return (
    <span
      className={cn(
        "inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold",
        full
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {done}/{total}
    </span>
  );
}

/* ---------- Titik status cabang ---------- */

export function BranchDot({ status }: { status: string }) {
  const color =
    status === "OPEN" ? "bg-red-600" : status === "FOLLOW_UP" ? "bg-amber-500" : "bg-emerald-500";
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color)} />;
}

/* ---------- Logo Dentico ---------- */

export function DenticoLogo({ size = 28, label = true }: { size?: number; label?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Dentico">
        <rect width="32" height="32" rx="8" fill="#E53935" />
        <path
          d="M16 8.2c-2.2-1.5-4.9-1.3-6.2.7-.9 1.5-.7 3.5 0 5.2.8 1.9 1.3 4.3 1.8 6.5.2.9 1.4.9 1.8.1.8-1.9 1.1-4.5 2.6-4.5s1.8 2.6 2.6 4.5c.4.8 1.6.8 1.8-.1.5-2.2 1-4.6 1.8-6.5.7-1.7.9-3.7 0-5.2-1.3-2-4-2.2-6.2-.7z"
          fill="#fff"
        />
        <path d="M15 27.5h2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.65" />
      </svg>
      {label && (
        <span className="text-[15px] font-extrabold tracking-tight text-gray-900">
          Dentico<span className="text-[#E53935]">.</span>
          <span className="ml-1 text-[11px] font-bold text-gray-400">Finance</span>
        </span>
      )}
    </span>
  );
}

/* ---------- Panel wrapper ---------- */

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
      {children}
    </section>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded", className)} />;
}
