"use client";

import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Banknote,
  Building2,
  CreditCard,
  FileText,
  LayoutGrid,
  ListChecks,
  QrCode,
  ShieldCheck,
  Smartphone,
  Table2,
  Timer,
} from "lucide-react";
import type { DailySheetId, WorkbookView } from "@/lib/types";
import { cn } from "./cn";
import { DenticoLogo } from "./ui";

const DAILY_IDS: string[] = ["overview", "shift", "app", "branch", "qris", "edc", "transfer"];

interface SidebarProps {
  active: WorkbookView;
  onNavigate: (v: WorkbookView) => void;
}

function NavItem({
  icon,
  label,
  mode = "idle",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  /** active = fitur daily control sedang dibuka; pending = halaman placeholder; idle = normal */
  mode?: "idle" | "active" | "pending";
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
        mode === "active" && "bg-[#E53935] font-semibold text-white shadow-sm shadow-red-200/60",
        mode === "pending" && "border border-dashed border-gray-300 bg-gray-100 font-semibold text-gray-800",
        mode === "idle" && "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
      )}
    >
      <span className="flex items-center gap-2.5">
        <span className={cn(mode === "active" ? "text-white" : "text-gray-400")}>{icon}</span>
        {label}
      </span>
      {mode === "active" ? (
        <span className="font-mono text-[9.5px] tracking-wider uppercase opacity-80">Active</span>
      ) : mode === "pending" ? (
        <span className="font-mono text-[9px] tracking-wider text-gray-400 uppercase">Soon</span>
      ) : null}
    </button>
  );
}

function GroupLabel({ children, dot = false }: { children: string; dot?: boolean }) {
  return (
    <div className="flex items-center justify-between px-2 pt-3.5 pb-1 first:pt-2">
      <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">{children}</span>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[#E53935]" />}
    </div>
  );
}

function PendingItem({
  icon,
  label,
  id,
  active,
  onNavigate,
}: {
  icon: ReactNode;
  label: string;
  id: WorkbookView;
  active: WorkbookView;
  onNavigate: (v: WorkbookView) => void;
}) {
  return <NavItem icon={icon} label={label} mode={active === id ? "pending" : "idle"} onClick={() => onNavigate(id)} />;
}

/** Ikon kecil untuk hint sheet di dalam tooltip overview */
const SHEET_ICONS: Record<DailySheetId, ReactNode> = {
  overview: <LayoutGrid size={11} />,
  shift: <Timer size={11} />,
  app: <Smartphone size={11} />,
  branch: <Table2 size={11} />,
  qris: <QrCode size={11} />,
  edc: <CreditCard size={11} />,
  transfer: <ArrowLeftRight size={11} />,
};

const SHEET_LABEL: Record<DailySheetId, string> = {
  overview: "Overview",
  shift: "Shift Report",
  app: "App Transaction",
  branch: "Branch Spreadsheet",
  qris: "QRIS",
  edc: "EDC",
  transfer: "Transfer",
};

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  const dailyActive = DAILY_IDS.includes(active);
  const sheetOpen = dailyActive ? (active as DailySheetId) : null;

  return (
    <aside className="fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-gray-200 bg-white shadow-[1px_0_8px_rgba(0,0,0,0.02)]">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
        <DenticoLogo />
        <span className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gray-500">
          XLSX v2.6
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3 text-xs">
        <GroupLabel dot>DAILY CONTROL</GroupLabel>
        <NavItem
          icon={<LayoutGrid size={16} strokeWidth={2.2} />}
          label="Overview"
          mode={dailyActive ? "active" : "idle"}
          onClick={() => onNavigate("overview")}
        />
        {/* Konteks sheet aktif — semua sub-fitur hidup di dalam Overview */}
        {dailyActive && sheetOpen && sheetOpen !== "overview" && (
          <div className="mt-0.5 mb-1 ml-4 flex items-center gap-1.5 rounded-md border-l-2 border-[#E53935] bg-red-50/60 py-1.5 pr-2 pl-2.5 text-[10.5px]">
            <span className="text-[#E53935]">{SHEET_ICONS[sheetOpen]}</span>
            <span className="font-semibold text-gray-800">Sheet: {SHEET_LABEL[sheetOpen]}</span>
            <span className="ml-auto font-mono text-[9px] text-gray-400">di dalam Overview</span>
          </div>
        )}
        {dailyActive && (
          <p className="mt-1 ml-2 text-[10px] leading-snug text-gray-400">
            Shift Report, App Transaction, Branch Spreadsheet, QRIS, EDC &amp; Transfer diakses lewat tab sheet di
            dalam Overview.
          </p>
        )}

        <GroupLabel>FINANCE</GroupLabel>
        <PendingItem icon={<Banknote size={16} strokeWidth={2.2} />} label="Cash Flow" id="cashflow" active={active} onNavigate={onNavigate} />
        <PendingItem icon={<ListChecks size={16} strokeWidth={2.2} />} label="Finance Tasks" id="tasks" active={active} onNavigate={onNavigate} />
        <PendingItem icon={<FileText size={16} strokeWidth={2.2} />} label="Reports" id="reports" active={active} onNavigate={onNavigate} />

        <GroupLabel>MONITORING</GroupLabel>
        <PendingItem icon={<Building2 size={16} strokeWidth={2.2} />} label="Branch Monitoring" id="monitoring" active={active} onNavigate={onNavigate} />
        <PendingItem icon={<BarChart3 size={16} strokeWidth={2.2} />} label="Brand & City Analysis" id="cityanalysis" active={active} onNavigate={onNavigate} />

        <GroupLabel>AUDIT</GroupLabel>
        <PendingItem icon={<ShieldCheck size={16} strokeWidth={2.2} />} label="Audit Trail" id="audittrail" active={active} onNavigate={onNavigate} />

        {/* Hint status modul */}
        {!dailyActive && (
          <div className="mx-2 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-snug text-amber-800">
            Modul ini masih dalam tahap perancangan dan belum terhubung ke workbook.
          </div>
        )}
      </nav>

      {/* Sync status */}
      <div className="m-2.5 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-700">Workbook Sync</span>
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-600">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Auto-Live
          </span>
        </div>
        <p className="font-mono text-[10px] text-gray-400">15m multi-sheet polling</p>
      </div>
    </aside>
  );
}
