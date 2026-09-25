import "dotenv/config";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* ------------------------------------------------------------------ */
/* Dummy data Dentico Finance — periode 16–21 Sep 2026                 */
/* ------------------------------------------------------------------ */

const BRANCHES: Array<{ code: string; name: string; city: string; brand: string }> = [
  { code: "SW", name: "Sleman West", city: "Yogyakarta", brand: "Dentico Smile" },
  { code: "KH", name: "Kotabaru HQ", city: "Yogyakarta", brand: "Dentico Smile" },
  { code: "WB", name: "Wirobrajan", city: "Yogyakarta", brand: "Dentico Smile" },
  { code: "JW", name: "Jogja West", city: "Yogyakarta", brand: "Dentico Care" },
  { code: "ST", name: "Seturan Central", city: "Yogyakarta", brand: "Dentico Care" },
  { code: "MD", name: "Malioboro Kids", city: "Yogyakarta", brand: "Dentico Kids" },
  { code: "BD", name: "Bandung Dago", city: "Bandung", brand: "Dentico Smile" },
  { code: "SP", name: "Senopati HQ", city: "Jakarta", brand: "Dentico Premium" },
];

type Txn = {
  channel: "QRIS" | "EDC" | "TRANSFER" | "CASH";
  amount: number;
  patient: string;
  treatment: string;
  branchAmount?: number; // jika diisi -> baris BRANCH dibuat beda (flagged)
};

type ChannelStatus = "MATCH" | "PENDING" | "EXCEPTION" | "NONE";

type SummarySeed = {
  branch: string;
  date: string; // YYYY-MM-DD
  shiftDone: number;
  status: "CLOSED" | "FOLLOW_UP" | "OPEN";
  txns: Txn[];
  shiftExpected?: number[]; // default split 3
  shiftPhysical?: number[];
  shiftNotes?: string[];
  channelStatus: Partial<Record<"QRIS" | "EDC" | "TRANSFER", ChannelStatus>>;
  channelNotes?: Partial<Record<"QRIS" | "EDC" | "TRANSFER", string>>;
  exception?: {
    severity: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    description: string;
    owner: string;
    status: "OPEN" | "FOLLOW_UP";
  };
  cashiers?: string[];
  supervisor?: string;
};

const CASHIERS = [
  "Ayu Lestari",
  "Bimo Saputra",
  "Dimas Aditya",
  "Citra Ayu",
  "Dewi Kania",
  "Eko Prasetyo",
  "Fitri Handayani",
  "Gita Maharani",
];
const SUPERVISORS = [
  "drg. Amanda Pratama",
  "drg. Reza Firmansyah",
  "drg. Nadia Salsabila",
  "drg. Yoga Aditama",
];

const SUMMARIES: SummarySeed[] = [
  // 1 — SW 16 Sep — CLOSED
  {
    branch: "SW",
    date: "2026-09-16",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 2500000, patient: "Tn. Bima Arya", treatment: "Veneer Porselen (2 Unit)" },
      { channel: "CASH", amount: 1950000, patient: "Ny. Dewi Sartika", treatment: "Perawatan Saluran Akar Molar" },
      { channel: "CASH", amount: 1951000, patient: "Nn. Laras Ayu", treatment: "Behel Pasang Rahang Atas" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "NONE", TRANSFER: "NONE" },
  },
  // 2 — KH 17 Sep — CLOSED
  {
    branch: "KH",
    date: "2026-09-17",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 620000, patient: "Ny. Ratna Sari", treatment: "Scaling & Stain Removal" },
      { channel: "EDC", amount: 605000, patient: "Tn. Yusuf Maulana", treatment: "Tambal Komposit 2 Gigi" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "NONE" },
  },
  // 3 — WB 21 Sep — OPEN (kasus utama drill-down)
  {
    branch: "WB",
    date: "2026-09-21",
    shiftDone: 3,
    status: "OPEN",
    txns: [
      { channel: "QRIS", amount: 620000, patient: "Tn. Ilham Prasetyo", treatment: "Rontgen Panoramik + Konsultasi" },
      { channel: "EDC", amount: 550000, patient: "Nn. Kirana Putri", treatment: "Kontrol Behel + Scan 3D" },
      {
        channel: "CASH",
        amount: 240000,
        branchAmount: 250000,
        patient: "Ny. Ratna Wulandari",
        treatment: "Scaling & Polishing",
      },
    ],
    shiftExpected: [400000, 570000, 440000],
    shiftPhysical: [400000, 570000, 450000],
    shiftNotes: ["", "", "Kelebihan fisik uang tunai laci kasir"],
    cashiers: ["Ayu Lestari", "Bimo Saputra", "Dimas Aditya"],
    supervisor: "drg. Amanda Pratama",
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "NONE" },
    exception: {
      severity: "HIGH",
      title: "Selisih Cabang +Rp10.000 (Over-Report Kas Tunai)",
      description:
        "Sheet Cabang Row #42 tercatat Rp250.000 vs aplikasi Rp240.000 untuk pelunasan Ny. Ratna Wulandari (kelebihan Rp10.000). Fisik laci Shift 3 juga berlebih Rp10.000 — indikasi kasir salah ketik total nominal.",
      owner: "Siti Rahmawati",
      status: "OPEN",
    },
  },
  // 4 — JW 21 Sep — FOLLOW_UP (transfer exception)
  {
    branch: "JW",
    date: "2026-09-21",
    shiftDone: 3,
    status: "FOLLOW_UP",
    txns: [
      { channel: "QRIS", amount: 300000, patient: "Nn. Salsa Amelia", treatment: "Konsultasi Ortodonti" },
      { channel: "EDC", amount: 200000, patient: "Tn. Fajri Nugroho", treatment: "Scaling Reguler" },
      { channel: "TRANSFER", amount: 350000, patient: "Ny. Melati Putri", treatment: "DP Perawatan Behel" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "EXCEPTION" },
    channelNotes: { TRANSFER: "Bukti transfer tidak terdeteksi di mutasi BCA s.d. 18:00" },
    exception: {
      severity: "MEDIUM",
      title: "Transfer Rp350.000 tanpa mutasi masuk",
      description:
        "DP perawatan behel Ny. Melati Putri (Row #57) belum terverifikasi pada mutasi BCA sampai pukul 18:00. Minta bukti ulang dari cabang & cek manual ke bank.",
      owner: "Bagus Prasetyo",
      status: "FOLLOW_UP",
    },
  },
  // 5 — ST 21 Sep — OPEN (under-report 400rb + shift 3 pending)
  {
    branch: "ST",
    date: "2026-09-21",
    shiftDone: 2,
    status: "OPEN",
    txns: [
      { channel: "QRIS", amount: 1950000, patient: "Ny. Helena Wong", treatment: "Veneer E-Max (1 Unit)" },
      {
        channel: "CASH",
        amount: 1400000,
        branchAmount: 1000000,
        patient: "Tn. Andre Wijaya",
        treatment: "Perawatan Saluran Akar",
      },
      { channel: "TRANSFER", amount: 900000, patient: "Nn. Tiara Anggraini", treatment: "Bleaching In-Office" },
    ],
    shiftExpected: [1650000, 1700000, 900000],
    shiftPhysical: [1650000, 1700000, 900000],
    shiftNotes: ["", "", "Laporan WA Shift 3 belum divalidasi SPV"],
    cashiers: ["Citra Ayu", "Dewi Kania", "Eko Prasetyo"],
    supervisor: "drg. Reza Firmansyah",
    channelStatus: { QRIS: "MATCH", TRANSFER: "PENDING", EDC: "NONE" },
    channelNotes: { TRANSFER: "Settlement VA belum masuk (T+1)" },
    exception: {
      severity: "HIGH",
      title: "Selisih Cabang −Rp400.000 (Under-Report)",
      description:
        "Input cabang (Row #61) untuk Tn. Andre Wijaya tercatat Rp1.000.000 vs aplikasi Rp1.400.000. Laporan Shift 3 juga belum divalidasi — prioritas eskalasi harian ke Kepala Cabang.",
      owner: "Siti Rahmawati",
      status: "OPEN",
    },
  },
  // 6 — MD 21 Sep — CLOSED
  {
    branch: "MD",
    date: "2026-09-21",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 2650000, patient: "An. Raka Pratama", treatment: "Perawatan Ortodonti Anak" },
      { channel: "EDC", amount: 4140000, patient: "Ny. Sinta Maharani", treatment: "Veneer + Gum Contouring" },
      { channel: "TRANSFER", amount: 1100000, patient: "Tn. Dedi Kurniawan", treatment: "Implant DP Tahap 1" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "MATCH" },
  },
  // 7 — BD 21 Sep — CLOSED
  {
    branch: "BD",
    date: "2026-09-21",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 3200000, patient: "Ny. Citra Kirana", treatment: "Invisalign Cicilan 2" },
      { channel: "EDC", amount: 5050000, patient: "Tn. Rangga Saputra", treatment: "Full Mouth Rehab Tahap 2" },
      { channel: "TRANSFER", amount: 1200000, patient: "Ny. Ayu Paramita", treatment: "DP Bleaching Premium" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "MATCH" },
  },
  // 8 — SP 21 Sep — CLOSED
  {
    branch: "SP",
    date: "2026-09-21",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 4500000, patient: "Tn. Damar Sasongko", treatment: "Smile Makeover Paket" },
      { channel: "EDC", amount: 5700000, patient: "Ny. Kirsten Amelia", treatment: "Veneer 6 Unit (Cicilan)" },
      { channel: "TRANSFER", amount: 1000000, patient: "Tn. Rio Haryanto", treatment: "Maintenance Tahunan" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "MATCH" },
  },
  // 9 — BD 18 Sep — CLOSED
  {
    branch: "BD",
    date: "2026-09-18",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 3500000, patient: "Ny. Farah Quinn", treatment: "Scaling + Polish Paket Keluarga" },
      { channel: "EDC", amount: 4300000, patient: "Tn. Galih Ramadhan", treatment: "Behel Self-Ligating Cicilan" },
      { channel: "CASH", amount: 1100000, patient: "Nn. Intan Permata", treatment: "Tambal Estetik + Konsultasi" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "NONE" },
  },
  // 10 — SP 19 Sep — CLOSED
  {
    branch: "SP",
    date: "2026-09-19",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 4100000, patient: "Tn. Kevin Alamsyah", treatment: "Invisalign Full Set Cicilan" },
      { channel: "EDC", amount: 5300000, patient: "Ny. Lola Amaria", treatment: "Veneer 4 Unit" },
      { channel: "TRANSFER", amount: 1000000, patient: "Tn. Fajar Sidik", treatment: "Gum Treatment Premium" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "MATCH" },
  },
  // 11 — MD 20 Sep — FOLLOW_UP (QRIS pending settlement)
  {
    branch: "MD",
    date: "2026-09-20",
    shiftDone: 3,
    status: "FOLLOW_UP",
    txns: [
      { channel: "QRIS", amount: 2150000, patient: "An. Naya Cantika", treatment: "Fissure Sealant + Fluoride" },
      { channel: "EDC", amount: 2470000, patient: "Ny. Purnama Sari", treatment: "Kontrol Retainer" },
      { channel: "CASH", amount: 500000, patient: "An. Bimo Aryo", treatment: "Konsultasi + Foto Oklusi" },
    ],
    channelStatus: { QRIS: "PENDING", EDC: "MATCH", TRANSFER: "NONE" },
    channelNotes: { QRIS: "Menunggu settlement QRIS T+1 dari BCA" },
    exception: {
      severity: "LOW",
      title: "Settlement QRIS Rp2.150.000 tertunda",
      description:
        "Nominal QRIS tanggal 20 Sep belum masuk mutasi T+1. Monitor sampai 23 Sep; buka tiket ke aggregator bila lewat batas.",
      owner: "Bagus Prasetyo",
      status: "FOLLOW_UP",
    },
  },
  // 12 — ST 19 Sep — CLOSED
  {
    branch: "ST",
    date: "2026-09-19",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 1300000, patient: "Tn. Ilham Fauzi", treatment: "Scaling + Polishing" },
      { channel: "EDC", amount: 1100000, patient: "Nn. Karina Wijaya", treatment: "Tambal Komposit" },
      { channel: "CASH", amount: 500000, patient: "Ny. Sari Melati", treatment: "Cabut Gigi Anak" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "NONE" },
  },
  // 13 — JW 18 Sep — CLOSED
  {
    branch: "JW",
    date: "2026-09-18",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 450000, patient: "Ny. Ulfa Rahma", treatment: "Scaling Reguler" },
      { channel: "CASH", amount: 700000, patient: "Tn. Banyu Biru", treatment: "Tambal + Konsultasi" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "NONE", TRANSFER: "NONE" },
  },
  // 14 — KH 20 Sep — CLOSED
  {
    branch: "KH",
    date: "2026-09-20",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 780000, patient: "Nn. Puspita Ayu", treatment: "Kontrol Behel Bulanan" },
      { channel: "EDC", amount: 1200000, patient: "Tn. Oktaviano Dwi", treatment: "Perawatan Saluran Akar" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "NONE" },
  },
  // 15 — SW 19 Sep — CLOSED
  {
    branch: "SW",
    date: "2026-09-19",
    shiftDone: 3,
    status: "CLOSED",
    txns: [
      { channel: "QRIS", amount: 2350000, patient: "Ny. Kirana Larasati", treatment: "Veneer 1 Unit" },
      { channel: "EDC", amount: 2400000, patient: "Tn. Bramantyo Nugroho", treatment: "Behel Ceramic Cicilan" },
      { channel: "TRANSFER", amount: 1000000, patient: "Nn. Tyas Anindya", treatment: "DP Invisalign" },
    ],
    channelStatus: { QRIS: "MATCH", EDC: "MATCH", TRANSFER: "MATCH" },
  },
];

const ACCOUNT_LABEL: Record<string, string> = {
  QRIS: "QRIS BCA",
  EDC: "EDC Mandiri",
  TRANSFER: "TF BCA •• 8821",
};

function fakeHash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `0x${(h >>> 0).toString(16).padStart(8, "0")}${((h ^ 0xabcdef) >>> 0).toString(16).padStart(8, "0")}`.slice(0, 18);
}

function splitThree(total: number): number[] {
  const a = Math.round(total * 0.34);
  const b = Math.round(total * 0.33);
  return [a, b, total - a - b];
}

export async function ensureSeeded() {
  const { data: existing, error: existingError } = await supabase.from('branches').select('id').limit(1);
  if (existingError) throw existingError;
  if (existing && existing.length > 0) {
    console.log('Skipped: data already seeded.');
    return false;
  }

  const { data: branchRows, error: branchError } = await supabase.from('branches').insert(BRANCHES).select();
  if (branchError) throw branchError;

  const byCode = new Map((branchRows ?? []).map((b) => [b.code, b.id]));
  const dmy = (iso: string) => new Date(`${iso}T09:00:00+07:00`);
  let prevHash = fakeHash("genesis-dentico");
  const logs: Array<{
    summary_id: number | null;
    action: string;
    actor: string;
    role: string;
    detail: string;
    hash: string;
    prev_hash: string;
    verified: boolean;
    created_at: string;
  }> = [];
  const pushLog = (
    summaryId: number | null,
    action: string,
    actor: string,
    role: string,
    detail: string,
    at: Date,
    verified = true,
  ) => {
    const hash = fakeHash(`${prevHash}${action}${actor}${at.toISOString()}`);
    logs.push({ summary_id: summaryId, action, actor, role, detail, hash, prev_hash: prevHash, verified, created_at: at.toISOString() });
    prevHash = hash;
  };

  pushLog(
    null,
    "WORKBOOK_OPENED",
    "Siti Rahmawati",
    "Finance Controller",
    "Workbook XLSX v2.6 dibuka — periode 16–21 Sep 2026, 15 hari-cabang ter-load.",
    new Date("2026-09-21T08:12:00+07:00"),
  );

  for (const [sortIdx, cfg] of SUMMARIES.entries()) {
    const branchId = byCode.get(cfg.branch);
    if (!branchId) continue;
    const appRevenue = cfg.txns.reduce((a, t) => a + t.amount, 0);
    const branchRevenue = cfg.txns.reduce((a, t) => a + (t.branchAmount ?? t.amount), 0);
    const shiftExp = cfg.shiftExpected ?? splitThree(appRevenue);
    const shiftPhys = cfg.shiftPhysical ?? [...shiftExp];
    const shiftRevenue = shiftPhys.reduce((a, b) => a + b, 0);

    const { data: summaryData, error: summaryError } = await supabase
      .from('daily_summaries')
      .insert({
        branch_id: branchId,
        date: cfg.date,
        shift_done: cfg.shiftDone,
        shift_total: 3,
        app_revenue: appRevenue,
        branch_revenue: branchRevenue,
        shift_revenue: shiftRevenue,
        diff_app_branch: appRevenue - branchRevenue,
        diff_branch_shift: branchRevenue - shiftRevenue,
        status: cfg.status,
        sort_key: sortIdx + 1,
        created_at: dmy(cfg.date).toISOString(),
      })
      .select()
      .single();

    if (summaryError) throw summaryError;
    const summary = summaryData;

    const dshort = cfg.date.slice(8, 10) + cfg.date.slice(5, 7);
    const base = dmy(cfg.date);

    // --- Transactions (APP + BRANCH sheet) ---
    for (const [i, t] of cfg.txns.entries()) {
      const refIdx = String(i + 1).padStart(2, "0");
      await supabase.from('transactions').insert([
        {
          summary_id: summary.id,
          source: "APP",
          reference: `TX-${cfg.branch}-${dshort}-${refIdx}`,
          patient_name: t.patient,
          treatment: t.treatment,
          channel: t.channel,
          amount: t.amount,
          input_by: "EMR Core App",
          status: t.branchAmount != null ? "OK" : "OK",
          note: "Closed Invoiced",
          flagged: t.branchAmount != null,
          created_at: new Date(base.getTime() + i * 3_600_000).toISOString(),
        },
        {
          summary_id: summary.id,
          source: "BRANCH",
          // WB 21 Sep dikunci ke Row #40-42 agar cocok dengan narasi exception (Row #42)
          reference: `Row #${cfg.branch === "WB" && cfg.date === "2026-09-21" ? 40 + i : 38 + sortIdx * 7 + i}`,
          patient_name: t.patient,
          treatment: t.branchAmount != null ? "Input Manual Kasir" : t.treatment,
          channel: t.channel,
          amount: t.branchAmount ?? t.amount,
          input_by: cfg.cashiers?.[2] ?? CASHIERS[(sortIdx + 2) % CASHIERS.length],
          status: t.branchAmount != null ? "MISMATCH" : "OK",
          note:
            t.branchAmount != null
              ? `Mismatch: kasir salah ketik total nominal (${
                  t.branchAmount > t.amount ? "+" : "-"
                }Rp${Math.abs(t.branchAmount - t.amount).toLocaleString("id-ID")})`
              : "Terverifikasi otomatis",
          flagged: t.branchAmount != null,
          created_at: new Date(base.getTime() + i * 3_600_000 + 600_000).toISOString(),
        },
      ]);
    }

    // --- Shift reports ---
    const cashiers =
      cfg.cashiers ??
      [0, 1, 2].map((k) => CASHIERS[(sortIdx * 3 + k) % CASHIERS.length]);
    const sup = cfg.supervisor ?? SUPERVISORS[sortIdx % SUPERVISORS.length];
    for (const [k, exp] of shiftExp.entries()) {
      const phys = shiftPhys[k] ?? exp;
      const variance = phys - exp;
      const isPending = cfg.shiftDone < 3 && k === 2;
      // Distribusi channel: QRIS ~40%, Transfer ~20%, EDC ~25%, Cash ~15%
      const qris = Math.round(phys * 0.40);
      const transfer = Math.round(phys * 0.20);
      const edc = Math.round(phys * 0.25);
      const cash = phys - qris - transfer - edc;
      await supabase.from('shift_reports').insert({
        summary_id: summary.id,
        shift_index: k + 1,
        cashier: cashiers[k],
        supervisor: sup,
        expected_amount: exp,
        physical_amount: phys,
        variance,
        status: isPending ? "PENDING" : variance === 0 ? "MATCH" : variance > 0 ? "OVER" : "UNDER",
        note: cfg.shiftNotes?.[k] ?? "",
        handover_at: `${7 + k * 6}45`.padStart(4, "0"),
        qris_amount: qris,
        transfer_amount: transfer,
        edc_amount: edc,
        cash_amount: cash,
      });
    }

    // --- Payment checks per channel ---
    for (const ch of ["QRIS", "EDC", "TRANSFER"] as const) {
      const st = cfg.channelStatus[ch] ?? "NONE";
      const expected = cfg.txns.filter((t) => t.channel === ch).reduce((a, t) => a + t.amount, 0);
      if (st === "NONE" && expected === 0) continue;
      const varianceAdj = ch === "TRANSFER" || ch === "QRIS" || ch === "EDC" ? 0 : 0;
      await supabase.from('payment_checks').insert({
        summary_id: summary.id,
        channel: ch,
        account_label: ACCOUNT_LABEL[ch],
        expected,
        actual: st === "MATCH" ? expected : st === "EXCEPTION" ? 0 : null,
        status: st,
        reference: st === "NONE" ? "" : `STLM-${ch}-${cfg.branch}-${dshort}`,
        note: cfg.channelNotes?.[ch] ?? "",
      });
      void varianceAdj;
    }

    // --- Exception ---
    if (cfg.exception) {
      await supabase.from('exceptions').insert({
        summary_id: summary.id,
        severity: cfg.exception.severity,
        title: cfg.exception.title,
        description: cfg.exception.description,
        owner: cfg.exception.owner,
        status: cfg.exception.status,
        created_at: new Date(base.getTime() + 40_000_000).toISOString(),
      });
    }

    // --- Audit logs khas summary bermasalah ---
    if (cfg.branch === "WB" && cfg.date === "2026-09-21") {
      pushLog(
        summary.id,
        "SYNC_APP",
        "Webhook EMR",
        "System",
        "Sinkron 3 transaksi dari aplikasi EMR ke sheet App Transaction.",
        new Date("2026-09-21T19:04:00+07:00"),
      );
      pushLog(
        summary.id,
        "EXCEL_IMPORT",
        "Siti Rahmawati",
        "Finance Controller",
        "Import Branch Spreadsheet WB_21SEP (3 baris) berhasil.",
        new Date("2026-09-21T19:20:00+07:00"),
      );
      pushLog(
        summary.id,
        "MANUAL_EDIT",
        "Dimas Aditya",
        "Kasir Shift 3",
        "Edit Row #42: Rp240.000 → Rp250.000 tanpa otorisasi SPV. Ditandai rule engine.",
        new Date("2026-09-21T19:22:00+07:00"),
      );
      pushLog(
        summary.id,
        "VARIANCE_DETECTED",
        "Rule Engine",
        "System",
        "Selisih App−Branch = −Rp10.000 pada sel C3 — status sheet diubah ke OPEN.",
        new Date("2026-09-21T19:22:30+07:00"),
      );
      pushLog(
        summary.id,
        "WA_REPORT_PARSED",
        "Bot WA Parser",
        "System",
        "Laporan Shift 3 WB diparse (confidence 97%) — fisik Rp450.000 vs ekspektasi Rp440.000.",
        new Date("2026-09-21T21:46:00+07:00"),
      );
    }
    if (cfg.branch === "ST" && cfg.date === "2026-09-21") {
      pushLog(
        summary.id,
        "VARIANCE_DETECTED",
        "Rule Engine",
        "System",
        "Selisih Branch−Shift = −Rp400.000 — eskalasi ke Finance Controller.",
        new Date("2026-09-21T19:58:00+07:00"),
      );
    }
    if (cfg.branch === "JW" && cfg.date === "2026-09-21") {
      pushLog(
        summary.id,
        "SETTLEMENT_CHECK",
        "Mutasi Bot BCA",
        "System",
        "Transfer Rp350.000 tidak ditemukan di mutasi sampai 18:00 — tiket FOLLOW_UP dibuat.",
        new Date("2026-09-21T18:02:00+07:00"),
      );
    }
    if (cfg.status === "CLOSED") {
      pushLog(
        summary.id,
        "SHEET_LOCKED",
        "Siti Rahmawati",
        "Finance Controller",
        `Sheet ${cfg.branch} ${cfg.date} diverifikasi & dikunci — semua channel MATCH.`,
        new Date(base.getTime() + 46_000_000),
      );
    }
  }

  if (logs.length > 0) {
    const { error: logsError } = await supabase.from('audit_logs').insert(logs);
    if (logsError) throw logsError;
  }
  console.log('Seed complete: dummy workbook inserted.');
  return true;
}

// Eksekusi langsung: `npx tsx src/db/seed.ts`
if (process.argv[1] && process.argv[1].includes("seed")) {
  ensureSeeded()
    .then((seeded) => {
      console.log(seeded ? "Seed complete: dummy workbook inserted." : "Skipped: data already seeded.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}