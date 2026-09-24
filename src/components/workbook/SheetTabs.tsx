"use client";

import {
  CalendarDays,
  Download,
} from "lucide-react";
import type { DailySheetId, MetaDto } from "@/lib/types";
import { cn } from "./cn";

/* 7 sheet yang menjadi fitur Daily Control */
export const TABS: Array<{ id: DailySheetId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "shift", label: "Shift Report" },
  { id: "app", label: "App Transaction" },
  { id: "branch", label: "Branch Spreadsheet" },
  { id: "qris", label: "QRIS" },
  { id: "edc", label: "EDC" },
  { id: "transfer", label: "Transfer" },
];

interface SheetTabsProps {
  active: DailySheetId;
  onChange: (s: DailySheetId) => void;
  meta: MetaDto | null;
  onExport: () => void;
}

export default function SheetTabs({ active, onChange, meta, onExport }: SheetTabsProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Sub-header workbook */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-1 text-xs">
        <div className="flex items-center gap-2">
          {active !== "overview" && (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-extrabold text-gray-900">Daily Control Workbook</h2>
              </div>
              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-600">
                Auto-synced: 15s ago
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm">
            <CalendarDays size={14} className="text-gray-400" />
            <span>
              Period: <strong className="font-bold text-gray-900">{meta?.period ?? "—"}</strong>
            </span>
          </div>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <Download size={14} className="text-gray-400" />
            Export Sheet
          </button>
        </div>
      </div>

      {/* Baris tab sheet */}
      <div className="flex items-center gap-4 overflow-x-auto border-b border-gray-200 bg-white px-4 text-xs mt-1">
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 py-3 font-medium transition-colors border-b-2",
                isActive
                  ? "border-[#E53935] font-bold text-[#E53935]"
                  : "border-transparent text-gray-500 hover:text-gray-900",
              )}
            >
              {t.label}
              {isActive && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#E53935]" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
