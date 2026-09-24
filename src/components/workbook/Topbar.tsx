"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Search, Upload } from "lucide-react";
import type { MetaDto } from "@/lib/types";
import { cn } from "./cn";

interface TopbarProps {
  search: string;
  onSearch: (v: string) => void;
  meta: MetaDto | null;
  onAlertClick: (summaryId: number) => void;
}

export default function Topbar({ search, onSearch, meta, onAlertClick }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(search);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => setLocal(search), [search]);

  // debounce cari
  useEffect(() => {
    const t = setTimeout(() => onSearch(local), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // shortcut Ctrl+F
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.querySelector("input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const alerts = meta?.alerts ?? [];

  return (
    <header className="fixed top-0 right-0 left-64 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-5">
      <div className="flex max-w-xl flex-1 items-center gap-3">
        <div className="hidden flex-col md:flex">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Dentico Finance › Control Hub
          </span>
          <span className="text-[13px] font-extrabold tracking-tight text-gray-900">
            DAILY_CONTROL_16-21SEP2026.xlsx
          </span>
        </div>
        <div ref={searchRef} className="relative hidden w-64 md:block">
          <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400" />
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="h-8 w-full rounded border border-gray-200 bg-gray-50 pr-3 pl-8 text-xs placeholder:text-gray-400 hover:bg-gray-100/80 focus:bg-white focus:ring-1 focus:ring-gray-400 focus:outline-none"
            placeholder="Find in workbook (Ctrl + F)..."
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-black"
          title="Import Branch Spreadsheet (.xlsx / .csv)"
        >
          <Upload size={14} />
          <span className="hidden sm:inline">Import Data</span>
        </button>

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
              open
                ? "border-gray-300 bg-gray-100 text-gray-900"
                : "border-gray-200 text-gray-600 hover:bg-gray-50",
            )}
          >
            <Bell size={16} strokeWidth={2.2} />
          </button>
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E53935] text-[9px] font-bold text-white">
              {alerts.length}
            </span>
          )}
          {open && (
            <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
              <div className="border-b border-gray-100 bg-gray-50 px-3.5 py-2 text-[11px] font-bold text-gray-700">
                Exception butuh tindakan ({alerts.length})
              </div>
              <div className="max-h-72 overflow-y-auto">
                {alerts.length === 0 && (
                  <p className="px-3.5 py-4 text-xs text-gray-400">Semua sheet bersih. Tidak ada exception terbuka.</p>
                )}
                {alerts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setOpen(false);
                      onAlertClick(a.summaryId);
                    }}
                    className="flex w-full items-start gap-2.5 border-b border-gray-50 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-red-50/50"
                  >
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        a.severity === "HIGH" ? "bg-[#E53935]" : a.severity === "MEDIUM" ? "bg-amber-500" : "bg-gray-400",
                      )}
                    />
                    <span className="flex-1">
                      <span className="block text-[11.5px] leading-snug font-semibold text-gray-900">{a.title}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-gray-400">
                        Cabang {a.branchCode} • klik untuk buka drill-down
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* Profile */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#E53935] to-[#8E24AA] text-[11px] font-extrabold text-white ring-1 ring-gray-200">
            SR
          </span>
          <div className="hidden flex-col text-left md:flex">
            <span className="text-xs leading-tight font-bold text-gray-900">Siti Rahmawati</span>
            <span className="text-[10px] leading-tight font-medium text-gray-500">Finance Controller</span>
          </div>
        </div>
      </div>
    </header>
  );
}
