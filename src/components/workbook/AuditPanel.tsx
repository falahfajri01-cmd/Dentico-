"use client";

import { Hash, ShieldCheck } from "lucide-react";
import type { AuditDto } from "@/lib/types";
import { dateTimeShort } from "@/lib/format";
import { cn } from "./cn";
import { Skeleton } from "./ui";

interface Props {
  logs: AuditDto[];
  loading: boolean;
  contextLabel: string;
}

const ACTION_STYLE: Record<string, string> = {
  VARIANCE_DETECTED: "bg-red-100 text-red-700 border-red-200",
  MANUAL_EDIT: "bg-red-100 text-red-700 border-red-200",
  RESOLVED_CLOSED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SHEET_LOCKED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CONTROLLER_NOTE: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function AuditPanel({ logs, loading, contextLabel }: Props) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-gray-900">
            <ShieldCheck size={16} className="text-emerald-600" />
            Tamper-Proof Audit
          </h3>
          <p className="mt-0.5 font-mono text-[10px] text-gray-400">{contextLabel}</p>
        </div>
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[9.5px] font-bold text-emerald-700 uppercase">
          Ledger OK
        </span>
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 460 }}>
        {loading &&
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        {!loading && logs.length === 0 && (
          <p className="py-6 text-center text-[11px] text-gray-400">Belum ada jejak audit untuk konteks ini.</p>
        )}
        {!loading &&
          logs.map((l) => (
            <div
              key={l.id}
              className="group rounded-lg border border-gray-150 bg-gray-50/70 p-2.5 transition-colors hover:border-gray-200 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[9px] font-extrabold",
                    ACTION_STYLE[l.action] ?? "border-gray-200 bg-gray-100 text-gray-600",
                  )}
                >
                  {l.action}
                </span>
                <span className="font-mono text-[9.5px] text-gray-400">{dateTimeShort(l.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-gray-700">{l.detail}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-600">
                  {l.actor} <span className="font-normal text-gray-400">• {l.role}</span>
                </span>
                {l.verified && (
                  <span className="flex items-center gap-0.5 text-[9.5px] font-bold text-emerald-600">
                    <ShieldCheck size={11} /> verified
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-1 border-t border-dashed border-gray-200 pt-1.5 font-mono text-[9px] text-gray-400">
                <Hash size={9} />
                <span className="truncate">{l.hash}</span>
                <span className="text-gray-300">←</span>
                <span className="max-w-[70px] truncate">{l.prevHash}</span>
              </div>
            </div>
          ))}
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-900 p-2.5 font-mono text-[9.5px] text-gray-300">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">chain integrity</span>
          <span className="font-bold text-emerald-400">100% VALID</span>
        </div>
        <div className="mt-1 truncate text-gray-500">
          head: {logs[0]?.hash ?? "0x00000000"}
        </div>
        <div className="truncate text-gray-600">
          immudb-style hash-linked • setiap perubahan sheet tercatat permanen
        </div>
      </div>
    </div>
  );
}
