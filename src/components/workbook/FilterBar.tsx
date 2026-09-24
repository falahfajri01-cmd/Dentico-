"use client";

import { Building2, ListFilter } from "lucide-react";
import type { BranchDto } from "@/lib/types";
import { cn } from "./cn";

interface FilterBarProps {
  q: string;
  onQ: (v: string) => void;
  brand: string;
  onBrand: (v: string) => void;
  city: string;
  onCity: (v: string) => void;
  branchCode: string;
  onBranchCode: (v: string) => void;
  brands: string[];
  cities: string[];
  branches: BranchDto[];
  status: string;
  onStatus: (v: string) => void;
  counts: { total: number; CLOSED: number; FOLLOW_UP: number; OPEN: number };
}

const STATUS_OPTS: Array<{ key: string; label: (c: FilterBarProps["counts"]) => string; className?: string }> = [
  { key: "", label: (c) => `Semua (${c.total})` },
  { key: "CLOSED", label: (c) => `Closed (${c.CLOSED})` },
  { key: "FOLLOW_UP", label: (c) => `Follow Up (${c.FOLLOW_UP})`, className: "text-amber-700" },
  { key: "OPEN", label: (c) => `Open (${c.OPEN})`, className: "font-bold text-red-600" },
];

export default function FilterBar(p: FilterBarProps) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <ListFilter size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400" />
          <input
            value={p.q}
            onChange={(e) => p.onQ(e.target.value)}
            className="h-8 w-full rounded-lg border border-gray-200 bg-white pr-2.5 pl-8 text-xs placeholder:text-gray-400 focus:ring-1 focus:ring-gray-300 focus:outline-none"
            placeholder="Filter Cabang (SW, WB, KH)..."
            type="text"
          />
        </div>

        <select
          value={p.brand}
          onChange={(e) => p.onBrand(e.target.value)}
          className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 pr-7 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:ring-1 focus:ring-gray-300 focus:outline-none"
        >
          <option value="">Brand: Semua</option>
          {p.brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={p.city}
          onChange={(e) => p.onCity(e.target.value)}
          className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 pr-7 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:ring-1 focus:ring-gray-300 focus:outline-none"
        >
          <option value="">Kota: Semua</option>
          {p.cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={p.branchCode}
          onChange={(e) => p.onBranchCode(e.target.value)}
          className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 pr-7 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:ring-1 focus:ring-gray-300 focus:outline-none"
        >
          <option value="">Cabang: Semua</option>
          {p.branches.map((b) => (
            <option key={b.id} value={b.code}>{b.code} — {b.name}</option>
          ))}
        </select>

        {(p.q || p.brand || p.city || p.branchCode || p.status) && (
          <button
            onClick={() => {
              p.onQ("");
              p.onBrand("");
              p.onCity("");
              p.onBranchCode("");
              p.onStatus("");
            }}
            className="h-8 rounded-lg px-2 text-[11px] font-semibold text-[#E53935] hover:bg-red-50"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {p.brand && (
          <div className="hidden items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-[#E53935] sm:flex">
            <Building2 size={11} /> Active Brand: {p.brand}
          </div>
        )}
        <div className="flex items-center rounded-lg bg-gray-200/70 p-0.5 text-xs font-medium">
          {STATUS_OPTS.map((opt) => {
            const isActive = p.status === opt.key;
            return (
              <button
                key={opt.key || "all"}
                onClick={() => p.onStatus(opt.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  isActive ? "bg-white font-bold text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900",
                  !isActive && opt.className,
                )}
              >
                {opt.label(p.counts)}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
