"use client";

import { useState } from "react";
import {
  CheckCheck,
  CheckCircle2,
  Clock,
  MessageSquareWarning,
  PenLine,
  ScanSearch,
  Smartphone,
  Table2,
  Timer,
} from "lucide-react";
import type { SummaryDetail } from "@/lib/types";
import { dateFull, rp, rpSign } from "@/lib/format";
import { cn } from "./cn";
import { ChannelPill, MatchPill, Skeleton, StatusPill } from "./ui";

interface Props {
  detail: SummaryDetail | null;
  loading: boolean;
  busy: boolean;
  onAction: (action: "resolve" | "note", note?: string) => void;
}

type SubTab = "app" | "branch" | "shift";

function ComparisonCard({
  title,
  refLabel,
  name,
  sub,
  amount,
  footer,
  hot = false,
  override,
}: {
  title: string;
  refLabel: string;
  name: string;
  sub: string;
  amount: number;
  footer: string;
  hot?: boolean;
  override?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between bg-white p-3",
        hot ? "border-[2.5px] border-[#E53935] shadow-sm" : "border border-gray-200",
      )}
    >
      <div>
        <div
          className={cn(
            "flex items-center justify-between font-mono text-[10px] font-bold uppercase",
            hot ? "text-[#E53935]" : "text-gray-400",
          )}
        >
          <span>{title}</span>
          <span className={cn(!hot && "text-blue-600")}>{refLabel}</span>
        </div>
        <div className="mt-1 text-xs font-bold text-gray-900">{name}</div>
        <div className={cn("text-[11px]", hot ? "font-medium text-red-600" : "text-gray-500")}>{sub}</div>
        <div className={cn("mt-2 font-num text-sm font-extrabold", hot ? "text-[#E53935]" : "text-gray-900")}>
          {rp(amount)}
          {override && <span className="ml-1 text-[10px] font-bold">({override})</span>}
        </div>
      </div>
      <div
        className={cn(
          "mt-2 border-t pt-1 font-mono text-[9.5px]",
          hot ? "border-red-100 font-medium text-red-500" : "border-gray-100 text-gray-400",
        )}
      >
        {footer}
      </div>
    </div>
  );
}

export default function Inspector({ detail, loading, busy, onAction }: Props) {
  const [tab, setTab] = useState<SubTab>("app");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  if (loading || !detail) {
    return (
      <div className="flex flex-col gap-3 xl:col-span-8">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const s = detail.summary;
  const appTxns = detail.txns.filter((t) => t.source === "APP");
  const branchTxns = detail.txns.filter((t) => t.source === "BRANCH");
  const flaggedApp = detail.txns.find((t) => t.source === "APP" && t.flagged);
  const flaggedBranch = detail.txns.find((t) => t.source === "BRANCH" && t.flagged);
  const varShift = detail.shifts.find((sh) => sh.status === "OVER" || sh.status === "UNDER");
  const hasIssue = s.status !== "CLOSED" || s.diffAppBranch !== 0 || s.diffBranchShift !== 0;
  const openExc = detail.exceptions.find((e) => e.status !== "RESOLVED");
  const pic = detail.shifts[detail.shifts.length - 1];
  const variance = s.diffAppBranch !== 0 ? s.diffAppBranch : s.diffBranchShift;

  const subTabs: Array<{ id: SubTab; label: string; icon: React.ReactNode }> = [
    { id: "app", label: `Sheet: App Transaction (${appTxns.length} Entries)`, icon: <Smartphone size={14} /> },
    { id: "branch", label: `Sheet: Branch Spreadsheet (${branchTxns.length} Entries)`, icon: <Table2 size={14} /> },
    { id: "shift", label: `Sheet: Shift Report (${detail.shifts.map((x) => `Shift ${x.shiftIndex}`).join(", ")})`, icon: <Timer size={14} /> },
  ];

  return (
    <div className="fade-slide flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-8">
      <div>
        {/* Header drill-down */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 font-mono text-xs font-extrabold text-white",
              s.status === "OPEN" ? "bg-[#E53935]" : s.status === "FOLLOW_UP" ? "bg-amber-500" : "bg-emerald-600",
            )}
          >
            Cell: {s.cellRef}
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-gray-900">
              Drill-Down Inspector:
              <span className={s.status === "OPEN" ? "text-[#E53935]" : "text-gray-700"}>
                {s.branchCode} ({s.branchName}) — {dateFull(s.date)}
              </span>
            </h3>
              <p className="mt-0.5 font-mono text-[11px] text-gray-500">
                PIC: <strong className="font-sans text-gray-800">{pic ? `${pic.cashier} (Kasir Shift ${pic.shiftIndex})` : "—"}</strong>{" "}
                • SPV: <strong className="font-sans text-gray-800">{pic?.supervisor ?? "—"}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {variance !== 0 ? (
              <div className="flex flex-col rounded-md border border-red-200 bg-red-50/50 px-3 py-1 text-xs">
                <span className="font-semibold text-[#E53935]">Variance:</span>
                <span className="font-extrabold text-[#E53935]">{rpSign(variance)}</span>
              </div>
            ) : (
              <span className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700">
                Variance: Rp0
              </span>
            )}
            {/* StatusPill was here, but Image 1 has no StatusPill at the top right of inspector */}
          </div>
        </div>

        {/* Sub-sheet tabs */}
        <div className="mt-3 flex flex-wrap items-center gap-1 border-b border-gray-200 pb-2 text-xs">
          <span className="mr-1 text-[10.5px] font-bold tracking-wider text-gray-400 uppercase">Linked Sub-Sheets:</span>
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors",
                tab === t.id
                  ? "border border-blue-200 bg-blue-50 font-bold text-blue-700"
                  : "bg-gray-100 font-medium text-gray-700 hover:bg-gray-200/70",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Isi sub-sheet */}
        <div className="mt-2.5 overflow-hidden rounded-lg border border-gray-200">
          <table className="sheet-grid w-full border-collapse text-left text-[11.5px] whitespace-nowrap">
            <thead>
              <tr className="bg-gray-100 font-mono text-[9.5px] font-bold tracking-wider text-gray-500 uppercase">
                {tab === "shift" ? (
                  <>
                    <th className="px-2.5 py-1.5">Shift</th>
                    <th className="px-2.5 py-1.5">Kasir</th>
                    <th className="px-2.5 py-1.5">Handover</th>
                    <th className="px-2.5 py-1.5 text-right">Ekspektasi</th>
                    <th className="px-2.5 py-1.5 text-right">Fisik Laci</th>
                    <th className="px-2.5 py-1.5 text-right">Selisih</th>
                    <th className="px-2.5 py-1.5 text-center">Status</th>
                    <th className="px-2.5 py-1.5">Catatan</th>
                  </>
                ) : (
                  <>
                    <th className="px-2.5 py-1.5">{tab === "app" ? "Ref" : "Sel"}</th>
                    <th className="px-2.5 py-1.5">Pasien</th>
                    <th className="px-2.5 py-1.5">Tindakan / Sumber</th>
                    <th className="px-2.5 py-1.5 text-center">Channel</th>
                    <th className="px-2.5 py-1.5">Diinput</th>
                    <th className="px-2.5 py-1.5 text-right">Nominal</th>
                    <th className="px-2.5 py-1.5">Validasi</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tab === "shift" &&
                detail.shifts.map((sh) => (
                  <tr key={sh.id} className={cn(sh.variance !== 0 && "bg-red-50/60")}>
                    <td className="px-2.5 py-1.5 font-mono font-bold text-gray-700">S{sh.shiftIndex}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-gray-800">{sh.cashier}</td>
                    <td className="px-2.5 py-1.5 font-mono text-gray-500">
                      {sh.handoverAt ? `${sh.handoverAt.slice(0, 2)}:${sh.handoverAt.slice(2)}` : "—"}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-num text-gray-700">{rp(sh.expectedAmount)}</td>
                    <td className="px-2.5 py-1.5 text-right font-num text-gray-700">{rp(sh.physicalAmount)}</td>
                    <td className="px-2.5 py-1.5 text-right font-num font-bold">
                      {sh.variance === 0 ? (
                        <span className="text-gray-400">Rp0</span>
                      ) : (
                        <span className="text-red-700">{rpSign(sh.variance)}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <MatchPill state={sh.status} />
                    </td>
                    <td className="max-w-[220px] truncate px-2.5 py-1.5 text-gray-500">{sh.note || "—"}</td>
                  </tr>
                ))}
              {tab !== "shift" &&
                (tab === "app" ? appTxns : branchTxns).map((t) => (
                  <tr key={t.id} className={cn(t.flagged && tab === "branch" && "bg-red-50/60")}>
                    <td className="px-2.5 py-1.5 font-mono text-[10.5px] font-bold text-blue-700">{t.reference}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-gray-800">{t.patientName}</td>
                    <td className={cn("px-2.5 py-1.5", t.flagged && tab === "branch" ? "text-red-600" : "text-gray-500")}>
                      {t.treatment}
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <ChannelPill channel={t.channel} />
                    </td>
                    <td className="px-2.5 py-1.5 text-gray-500">{t.inputBy}</td>
                    <td
                      className={cn(
                        "px-2.5 py-1.5 text-right font-num font-bold",
                        t.flagged && tab === "branch" ? "text-[#E53935]" : "text-gray-800",
                      )}
                    >
                      {rp(t.amount)}
                    </td>
                    <td className="max-w-[220px] truncate px-2.5 py-1.5 font-mono text-[10px] text-gray-400">
                      {t.status === "MISMATCH" ? <span className="font-bold text-red-600">MISMATCH — {t.note}</span> : t.note}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Root cause / sync card */}
        {hasIssue ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50/40 p-4 text-xs">
            <div className="mb-3 flex items-center justify-between border-b border-red-200/60 pb-2">
              <span className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-red-900">
                <ScanSearch size={15} className="text-[#E53935]" />
                {openExc ? `ROOT CAUSE: ${openExc.title}` : "Terdapat selisih antar sumber — perlu eskalasi"}
              </span>
              <span className="font-num text-xs font-bold text-red-600">{rpSign(variance)}</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              <ComparisonCard
                title="Source 1: Core EMR App"
                refLabel={flaggedApp?.reference ?? appTxns[appTxns.length - 1]?.reference ?? "—"}
                name={flaggedApp?.patientName ?? appTxns[appTxns.length - 1]?.patientName ?? "—"}
                sub={`Tindakan: ${flaggedApp?.treatment ?? appTxns[appTxns.length - 1]?.treatment ?? "—"}`}
                amount={flaggedApp?.amount ?? appTxns[appTxns.length - 1]?.amount ?? 0}
                footer="Status: Closed Invoiced"
              />
              <ComparisonCard
                title="Source 2: Branch Sheet"
                refLabel={flaggedBranch?.reference ?? branchTxns[branchTxns.length - 1]?.reference ?? "—"}
                name={flaggedBranch?.patientName ?? branchTxns[branchTxns.length - 1]?.patientName ?? "—"}
                sub={`Input Manual ${flaggedBranch?.inputBy ?? branchTxns[branchTxns.length - 1]?.inputBy ?? "Kasir"}`}
                amount={flaggedBranch?.amount ?? branchTxns[branchTxns.length - 1]?.amount ?? 0}
                override={
                  flaggedApp && flaggedBranch && flaggedBranch.amount !== flaggedApp.amount
                    ? `${flaggedBranch.amount > flaggedApp.amount ? "+" : "−"}${rp(
                        Math.abs(flaggedBranch.amount - flaggedApp.amount),
                      )} ${flaggedBranch.amount > flaggedApp.amount ? "Over" : "Under"}`
                    : undefined
                }
                footer={
                  flaggedBranch
                    ? "Mismatch: kasir salah ketik total nominal"
                    : "Terverifikasi — nominal sesuai aplikasi"
                }
                hot={!!flaggedBranch && flaggedBranch.amount !== flaggedApp?.amount}
              />
              <ComparisonCard
                title="Source 3: WA Shift Report"
                refLabel={varShift ? `Shift ${varShift.shiftIndex} Handover` : "Shift Handover"}
                name="Fisik Uang Kasir"
                sub={varShift ? `Total Shift ${varShift.shiftIndex} Kasir ${s.branchCode}` : "Total seluruh shift"}
                amount={varShift ? varShift.physicalAmount : s.shiftRevenue}
                footer={varShift ? "Kelebihan/kurang fisik uang tunai laci kasir" : "Fisik sesuai laporan WA"}
                hot={!!varShift && !flaggedBranch ? true : false}
              />
            </div>
            {openExc && (
              <p className="mt-2.5 leading-relaxed text-[11px] text-red-800/80">{openExc.description}</p>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={15} className="text-emerald-600" />
            Semua 3 sumber (App EMR, Sheet Cabang, Laporan Shift WA) sinkron — tidak ada selisih. Sheet aman untuk dikunci.
          </div>
        )}

        {/* Payment channel checklist */}
        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/50 p-2">
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            {(["QRIS", "EDC", "TRANSFER"] as const).map((ch) => {
              const pay = detail.payments.find((x) => x.channel === ch);
              return (
                <div
                  key={ch}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5"
                >
                  <span className="text-[11px] text-gray-500">{pay?.accountLabel ?? ch}:</span>
                  {!pay || pay.status === "NONE" ? (
                    <span className="font-mono text-[11px] text-gray-400">No Trx (—)</span>
                  ) : pay.status === "MATCH" ? (
                    <span className="flex items-center gap-1.5 font-num text-[11px] font-bold text-[#059669]">
                      <CheckCircle2 size={14} className="text-[#059669]" /> Match ({rp(pay.expected)})
                    </span>
                  ) : pay.status === "PENDING" ? (
                    <span className="flex items-center gap-1 font-num text-[11px] font-bold text-amber-600">
                      <Clock size={13} /> Pending ({rp(pay.expected)})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-num text-[11px] font-bold text-red-600">
                      <ScanSearch size={13} /> Exception ({rp(pay.expected)})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
        <div className="font-mono text-[10px] text-gray-400">
          Owner: <span className="font-bold text-gray-600">{openExc?.owner ?? "Siti Rahmawati"}</span> • SLA: tutup
          dalam 1×24 jam
        </div>
        <div className="flex items-center gap-2">
          {noteOpen ? (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                onAction("note", note.trim());
                setNote("");
                setNoteOpen(false);
              }}
            >
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan penyesuaian…"
                className="h-8 w-56 rounded-lg border border-gray-300 px-2.5 text-xs focus:ring-1 focus:ring-gray-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-8 rounded-lg bg-gray-900 px-2.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                Simpan
              </button>
            </form>
          ) : (
            <button
              onClick={() => setNoteOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <PenLine size={13} className="text-gray-400" />
              Catat Penyesuaian
            </button>
          )}
          <button
            onClick={() => onAction("note", "Permintaan laporan ulang WA dikirim ke kasir & SPV cabang untuk klarifikasi selisih.")}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <MessageSquareWarning size={13} className="text-gray-400" />
            Minta Laporan Ulang
          </button>
          {s.status !== "CLOSED" && (
            <button
              onClick={() => onAction("resolve")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-[#E53935] px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-red-200/60 transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              <CheckCheck size={13} />
              {busy ? "Memproses…" : "Tandai Selesai & Kunci"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
