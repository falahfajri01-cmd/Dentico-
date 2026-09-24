/* Client-safe DTO types yang dipakai UI workbook */

export type SheetId =
  | "overview"
  | "shift"
  | "app"
  | "branch"
  | "qris"
  | "edc"
  | "transfer"
  | "recon"
  | "exception";

/** Sheet yang tergabung dalam fitur Daily Control (7 tab workbook) */
export type DailySheetId = "overview" | "shift" | "app" | "branch" | "qris" | "edc" | "transfer";

/** Modul sidebar di bawah Finance — belum diimplementasikan (halaman kosong) */
export type PlaceholderView =
  | "cashflow"
  | "tasks"
  | "reports"
  | "monitoring"
  | "cityanalysis"
  | "audittrail";

export type WorkbookView = DailySheetId | PlaceholderView;

export type SummaryStatus = "CLOSED" | "FOLLOW_UP" | "OPEN";
export type MatchState = "MATCH" | "PENDING" | "EXCEPTION" | "NONE";

export interface BranchDto {
  id: number;
  code: string;
  name: string;
  city: string;
  brand: string;
}

export interface SummaryRow {
  id: number;
  rowIndex: number; // nomor baris workbook (1-based)
  cellRef: string; // contoh: C3
  date: string; // ISO
  dateLabel: string; // 16 Sep
  branchCode: string;
  branchName: string;
  city: string;
  brand: string;
  shiftDone: number;
  shiftTotal: number;
  appRevenue: number;
  branchRevenue: number;
  shiftRevenue: number;
  diffAppBranch: number;
  diffBranchShift: number;
  qris: MatchState;
  edc: MatchState;
  transfer: MatchState;
  status: SummaryStatus;
}

export interface SummaryPage {
  rows: SummaryRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { total: number; CLOSED: number; FOLLOW_UP: number; OPEN: number };
}

export interface TxnDto {
  id: number;
  source: "APP" | "BRANCH" | "SHIFT";
  reference: string;
  patientName: string;
  treatment: string;
  channel: string;
  amount: number;
  inputBy: string;
  status: string;
  note: string;
  flagged: boolean;
}

export interface ShiftDto {
  id: number;
  shiftIndex: number;
  cashier: string;
  supervisor: string;
  expectedAmount: number;
  physicalAmount: number;
  variance: number;
  status: "MATCH" | "OVER" | "UNDER" | "PENDING";
  note: string;
  handoverAt: string;
}

export interface PaymentDto {
  id: number;
  channel: "QRIS" | "EDC" | "TRANSFER";
  accountLabel: string;
  expected: number;
  actual: number | null;
  status: MatchState;
  reference: string;
  note: string;
}

export interface ExceptionDto {
  id: number;
  summaryId: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  owner: string;
  status: "OPEN" | "FOLLOW_UP" | "RESOLVED";
  createdAt: string;
  branchCode?: string;
  branchName?: string;
  dateLabel?: string;
  varianceAbs?: number;
}

export interface AuditDto {
  id: number;
  summaryId: number | null;
  action: string;
  actor: string;
  role: string;
  detail: string;
  hash: string;
  prevHash: string;
  verified: boolean;
  createdAt: string;
}

export interface SummaryDetail {
  summary: SummaryRow;
  txns: TxnDto[];
  shifts: ShiftDto[];
  payments: PaymentDto[];
  exceptions: ExceptionDto[];
  logs: AuditDto[];
}

export interface MetaDto {
  period: string;
  counts: { total: number; CLOSED: number; FOLLOW_UP: number; OPEN: number };
  totals: {
    app: number;
    branch: number;
    shift: number;
    openVariance: number;
    matchRate: number;
  };
  branches: BranchDto[];
  cities: string[];
  brands: string[];
  alerts: Array<{ id: number; title: string; severity: string; summaryId: number; branchCode: string }>;
  logs: AuditDto[];
}

export interface SheetPayload {
  sheet: SheetId;
  columns: Array<{
    key: string;
    label: string;
    align?: "left" | "right" | "center";
    money?: boolean;
    sign?: boolean;
    badge?: "match" | "status" | "severity" | "channel" | "branch";
  }>;
  rows: Array<Record<string, string | number | null>>;
}
