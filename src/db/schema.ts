import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Dentico Finance — Digital Finance Workbook schema
 * Semua nominal disimpan sebagai integer Rupiah penuh.
 */

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(), // SW, KH, WB...
  name: varchar("name", { length: 80 }).notNull(), // Sleman West
  city: varchar("city", { length: 40 }).notNull(), // Yogyakarta / Bandung / Jakarta
  brand: varchar("brand", { length: 60 }).notNull(), // Dentico Smile / Care / Kids
});

export const dailySummaries = pgTable("daily_summaries", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id")
    .notNull()
    .references(() => branches.id),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  shiftDone: integer("shift_done").notNull().default(3),
  shiftTotal: integer("shift_total").notNull().default(3),
  appRevenue: integer("app_revenue").notNull(), // omzet dari aplikasi EMR
  branchRevenue: integer("branch_revenue").notNull(), // omzet input cabang
  shiftRevenue: integer("shift_revenue").notNull(), // omzet laporan shift (WA)
  // App−Branch, Branch−Shift (tersimpan agar query/jumlah mudah)
  diffAppBranch: integer("diff_app_branch").notNull().default(0),
  diffBranchShift: integer("diff_branch_shift").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("CLOSED"), // CLOSED | FOLLOW_UP | OPEN
  sortKey: integer("sort_key").notNull().default(0), // urutan tampil workbook
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id")
    .notNull()
    .references(() => dailySummaries.id),
  source: varchar("source", { length: 10 }).notNull(), // APP | BRANCH | SHIFT
  reference: varchar("reference", { length: 32 }).notNull(), // TX-WB-0921-03 / Row #42
  patientName: varchar("patient_name", { length: 80 }).notNull(),
  treatment: varchar("treatment", { length: 120 }).notNull(),
  channel: varchar("channel", { length: 12 }).notNull(), // CASH | QRIS | EDC | TRANSFER
  amount: integer("amount").notNull(),
  inputBy: varchar("input_by", { length: 80 }).notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("OK"), // OK | MISMATCH | MISSING
  note: text("note").notNull().default(""),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shiftReports = pgTable("shift_reports", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id")
    .notNull()
    .references(() => dailySummaries.id),
  shiftIndex: integer("shift_index").notNull(), // 1..3
  cashier: varchar("cashier", { length: 80 }).notNull(),
  supervisor: varchar("supervisor", { length: 80 }).notNull(),
  expectedAmount: integer("expected_amount").notNull(), // ekspektasi dari app
  physicalAmount: integer("physical_amount").notNull(), // fisik laci kasir
  variance: integer("variance").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("MATCH"), // MATCH | OVER | UNDER | PENDING
  note: text("note").notNull().default(""),
  handoverAt: varchar("handover_at", { length: 8 }).notNull().default(""),
  // breakdown channel per shift (diisi kasir)
  qrisAmount: integer("qris_amount").notNull().default(0),
  transferAmount: integer("transfer_amount").notNull().default(0),
  edcAmount: integer("edc_amount").notNull().default(0),
  cashAmount: integer("cash_amount").notNull().default(0),
});

export const paymentChecks = pgTable("payment_checks", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id")
    .notNull()
    .references(() => dailySummaries.id),
  channel: varchar("channel", { length: 12 }).notNull(), // QRIS | EDC | TRANSFER
  accountLabel: varchar("account_label", { length: 40 }).notNull(), // QRIS BCA / EDC Mandiri
  expected: integer("expected").notNull(),
  actual: integer("actual"), // null = belum settlement
  status: varchar("status", { length: 16 }).notNull().default("MATCH"), // MATCH | PENDING | EXCEPTION | NONE
  reference: varchar("reference", { length: 40 }).notNull().default(""),
  note: text("note").notNull().default(""),
});

export const exceptions = pgTable("exceptions", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id")
    .notNull()
    .references(() => dailySummaries.id),
  severity: varchar("severity", { length: 8 }).notNull().default("MEDIUM"), // HIGH | MEDIUM | LOW
  title: varchar("title", { length: 140 }).notNull(),
  description: text("description").notNull(),
  owner: varchar("owner", { length: 80 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("OPEN"), // OPEN | FOLLOW_UP | RESOLVED
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id").references(() => dailySummaries.id),
  action: varchar("action", { length: 40 }).notNull(), // SYNC_APP, MANUAL_EDIT...
  actor: varchar("actor", { length: 80 }).notNull(),
  role: varchar("role", { length: 40 }).notNull(),
  detail: text("detail").notNull(),
  hash: varchar("hash", { length: 24 }).notNull(),
  prevHash: varchar("prev_hash", { length: 24 }).notNull(),
  verified: boolean("verified").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Branch = typeof branches.$inferSelect;
export type DailySummary = typeof dailySummaries.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type ShiftReport = typeof shiftReports.$inferSelect;
export type PaymentCheck = typeof paymentChecks.$inferSelect;
export type ExceptionItem = typeof exceptions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
