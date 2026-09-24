"use client";

import type { ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Banknote,
  Building2,
  CircleMinus,
  FileText,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import type { PlaceholderView } from "@/lib/types";

interface PlaceholderConfig {
  group: string;
  title: string;
  icon: ReactNode;
  desc: string;
  soon: string[];
}

const CONFIG: Record<PlaceholderView, PlaceholderConfig> = {
  cashflow: {
    group: "Finance",
    title: "Cash Flow",
    icon: <Banknote size={26} strokeWidth={1.8} />,
    desc: "Modul arus kas masuk/keluar lintas channel settlement (QRIS, EDC, Transfer) dan posisi saldo harian per cabang.",
    soon: ["Ringkasan inflow vs outflow per channel settlement", "Aging settlement T+1 / T+2 per bank", "Alert saldo minimum kas kecil cabang"],
  },
  tasks: {
    group: "Finance",
    title: "Finance Tasks",
    icon: <ListChecks size={26} strokeWidth={1.8} />,
    desc: "Daftar tugas closing harian tim finance: verifikasi, follow-up cabang, dan sign-off sebelum workbook dikunci.",
    soon: ["Checklist closing otomatis dari status sheet", "Assign task ke controller & admin cabang", "Reminder SLA via WhatsApp / email"],
  },
  reports: {
    group: "Finance",
    title: "Reports",
    icon: <FileText size={26} strokeWidth={1.8} />,
    desc: "Generator laporan keuangan periode harian/mingguan/bulanan siap cetak untuk management review.",
    soon: ["Export PDF rekonsiliasi multi-cabang", "Laporan P&L ringkas per cabang", "Jadwal kirim laporan otomatis"],
  },
  monitoring: {
    group: "Monitoring",
    title: "Branch Monitoring",
    icon: <Building2 size={26} strokeWidth={1.8} />,
    desc: "Pantauan real-time kesehatan operasional 8 cabang: omzet, kehadiran kasir, dan status sheet harian.",
    soon: ["Heatmap performa omzet cabang", "Deteksi cabang yang belum submit sheet", "Ranking ketepatan closing shift"],
  },
  cityanalysis: {
    group: "Monitoring",
    title: "Brand & City Analysis",
    icon: <BarChart3 size={26} strokeWidth={1.8} />,
    desc: "Analitik perbandingan performa antar brand (Smile, Care, Kids, Premium) dan antar kota operasional.",
    soon: ["Tren omzet per brand & kota", "Share channel pembayaran per wilayah", "Benchmark rata-rata tiket pasien"],
  },
  audittrail: {
    group: "Audit",
    title: "Audit Trail",
    icon: <ShieldCheck size={26} strokeWidth={1.8} />,
    desc: "Eksplorasi penuh ledger tamper-proof — penelusuran hash-chain, replay perubahan sel, dan ekspor bukti audit.",
    soon: ["Pencarian lintas seluruh hash-chain", "Replay histori perubahan per sel", "Ekspor bundle bukti untuk auditor"],
  },
};

export default function EmptyFeature({ view, onBack }: { view: PlaceholderView; onBack: () => void }) {
  const c = CONFIG[view];
  return (
    <div className="fade-slide flex flex-1 items-start justify-center pt-8 pb-10">
      <div className="w-full max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-400">
          {c.icon}
        </div>
        <span className="mt-4 inline-block rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-widest text-gray-500 uppercase">
          {c.group} Module
        </span>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-gray-900">{c.title}</h2>
        <span className="mt-1.5 inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
          Sedang disiapkan — Milestone v2.7
        </span>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-gray-500">{c.desc}</p>

        <div className="mx-auto mt-5 max-w-md rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-left">
          <p className="mb-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase">Rencana isi modul</p>
          <ul className="space-y-1.5">
            {c.soon.map((s) => (
              <li key={s} className="flex items-start gap-2 text-[11.5px] text-gray-600">
                <CircleMinus size={12} className="mt-0.5 shrink-0 text-gray-300" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-black"
        >
          <ArrowLeft size={14} />
          Kembali ke Daily Control
        </button>
      </div>
    </div>
  );
}
