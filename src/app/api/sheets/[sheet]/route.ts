import { supabase } from '@/lib/supabase';
import { seeded } from '@/lib/queries';
import { dateShort } from '@/lib/format';
import type { SheetPayload } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Col = SheetPayload['columns'][number];

export async function GET(req: Request, ctx: { params: Promise<{ sheet: string }> }) {
  try {
    const { sheet } = await ctx.params;
    const url = new URL(req.url);
    await seeded();
    const payload = await buildSheet(sheet, {
      brand: url.searchParams.get('brand') ?? undefined,
      city: url.searchParams.get('city') ?? undefined,
      branchCode: url.searchParams.get('branch') ?? undefined,
    });
    if (!payload) return Response.json({ error: 'Sheet tidak dikenal' }, { status: 404 });
    return Response.json(payload);
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Gagal memuat sheet' }, { status: 500 });
  }
}

const NO_COL: Col = { key: 'no', label: '#', align: 'center' };

async function getFilteredBranchIds(filters: { brand?: string; city?: string; branchCode?: string }) {
  let query = supabase.from('branches').select('id, code, name, city, brand');
  const { data: branches, error } = await query;
  if (error) throw error;
  return (branches ?? [])
    .filter((b) => (!filters.brand || b.brand === filters.brand) && (!filters.city || b.city === filters.city) && (!filters.branchCode || b.code === filters.branchCode))
    .map((b) => b.id);
}

async function buildSheet(
  sheet: string,
  filters: { brand?: string; city?: string; branchCode?: string },
): Promise<SheetPayload | null> {
  const branchIds = await getFilteredBranchIds(filters);
  if (branchIds.length === 0) {
    return { sheet: sheet as SheetPayload['sheet'], columns: [], rows: [] };
  }

  switch (sheet) {
    case 'shift': {
      const { data: shifts, error } = await supabase
        .from('shift_reports')
        .select('*, daily_summaries!inner(id, date, sort_key, branch_id), branches!inner(id, code, name)')
        .in('daily_summaries.branch_id', branchIds)
        .order('daily_summaries.sort_key', { ascending: true })
        .order('shift_index', { ascending: true });
      if (error) throw error;

      return {
        sheet: 'shift',
        columns: [
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang' },
          { key: 'shift', label: 'Shift' },
          { key: 'pendapatan', label: '# Pendapatan' },
          { key: 'qris', label: '# QRIS' },
          { key: 'transfer', label: '# Transfer' },
          { key: 'edc', label: '# EDC' },
          { key: 'cash', label: '# Cash' },
        ],
        rows: (shifts ?? []).map((r) => ({
          id: r.id,
          summaryId: r.daily_summaries.id,
          tanggal: dateShort(r.daily_summaries.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          branchCode: r.branches.code,
          branchName: r.branches.name,
          shift: r.shift_index,
          kasir: r.cashier,
          spv: r.supervisor,
          pendapatan: r.physical_amount,
          qris: r.qris_amount,
          transfer: r.transfer_amount,
          edc: r.edc_amount,
          cash: r.cash_amount,
          ekspektasi: r.expected_amount,
          selisih: r.variance,
          status: r.status,
        })),
      };
    }
    case 'app':
    case 'branch': {
      const source = sheet === 'app' ? 'APP' : 'BRANCH';
      const { data: txns, error } = await supabase
        .from('transactions')
        .select('*, daily_summaries!inner(id, date, sort_key, branch_id), branches!inner(id, code, name)')
        .eq('source', source)
        .in('daily_summaries.branch_id', branchIds)
        .order('daily_summaries.sort_key', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;

      return {
        sheet: sheet as SheetPayload['sheet'],
        columns: [
          NO_COL,
          { key: 'ref', label: sheet === 'app' ? 'Ref Transaksi' : 'Sel Sheet' },
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang', badge: 'branch' },
          { key: 'pasien', label: 'Pasien' },
          { key: 'tindakan', label: 'Tindakan' },
          { key: 'channel', label: 'Channel', align: 'center', badge: 'channel' },
          { key: 'input', label: 'Diinput Oleh' },
          { key: 'nominal', label: 'Nominal', align: 'right', money: true },
          { key: 'status', label: 'Validasi', align: 'center', badge: 'match' },
        ],
        rows: (txns ?? []).map((r, i) => ({
          id: r.id,
          no: i + 1,
          summaryId: r.daily_summaries.id,
          ref: r.reference,
          tanggal: dateShort(r.daily_summaries.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          pasien: r.patient_name,
          tindakan: r.treatment,
          channel: r.channel,
          input: r.input_by,
          nominal: r.amount,
          status: r.status === 'MISMATCH' ? 'MISMATCH' : r.flagged ? 'REVIEW' : 'MATCH',
        })),
      };
    }
    case 'qris':
    case 'edc':
    case 'transfer': {
      const channel = sheet.toUpperCase();
      const { data: checks, error } = await supabase
        .from('payment_checks')
        .select('*, daily_summaries!inner(id, date, sort_key, branch_id), branches!inner(id, code, name)')
        .eq('channel', channel)
        .in('daily_summaries.branch_id', branchIds)
        .order('daily_summaries.sort_key', { ascending: true });
      if (error) throw error;

      return {
        sheet: sheet as SheetPayload['sheet'],
        columns: [
          NO_COL,
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang', badge: 'branch' },
          { key: 'akun', label: 'Akun Settlement' },
          { key: 'ekspektasi', label: 'Ekspektasi (App)', align: 'right', money: true },
          { key: 'settlement', label: 'Mutasi Bank', align: 'right', money: true },
          { key: 'selisih', label: 'Selisih', align: 'right', money: true, sign: true },
          { key: 'ref', label: 'Ref Settlement' },
          { key: 'status', label: 'Status', align: 'center', badge: 'match' },
          { key: 'catatan', label: 'Catatan' },
        ],
        rows: (checks ?? []).map((r, i) => ({
          id: r.id,
          no: i + 1,
          summaryId: r.daily_summaries.id,
          tanggal: dateShort(r.daily_summaries.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          akun: r.account_label,
          ekspektasi: r.expected,
          settlement: r.actual,
          selisih: r.actual == null ? null : r.actual - r.expected,
          ref: r.reference || '—',
          status: r.status,
          catatan: r.note || '—',
        })),
      };
    }
    case 'recon': {
      const { data: summaries, error } = await supabase
        .from('daily_summaries')
        .select('*, branches!inner(id, code, name)')
        .in('branch_id', branchIds)
        .or("diff_app_branch.neq.0,diff_branch_shift.neq.0,status.neq.CLOSED")
        .order('sort_key', { ascending: true });
      if (error) throw error;

      return {
        sheet: 'recon',
        columns: [
          NO_COL,
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang', badge: 'branch' },
          { key: 'app', label: 'App Revenue', align: 'right', money: true },
          { key: 'cab', label: 'Branch Revenue', align: 'right', money: true },
          { key: 'shf', label: 'Shift Revenue', align: 'right', money: true },
          { key: 'd1', label: 'Δ App−Cabang', align: 'right', money: true, sign: true },
          { key: 'd2', label: 'Δ Cabang−Shift', align: 'right', money: true, sign: true },
          { key: 'status', label: 'Status', align: 'center', badge: 'status' },
        ],
        rows: (summaries ?? []).map((r, i) => ({
          no: i + 1,
          summaryId: r.id,
          tanggal: dateShort(r.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          app: r.app_revenue,
          cab: r.branch_revenue,
          shf: r.shift_revenue,
          d1: r.diff_app_branch,
          d2: r.diff_branch_shift,
          status: r.status,
        })),
      };
    }
    case 'exception': {
      const { data: excs, error } = await supabase
        .from('exceptions')
        .select('*, daily_summaries!inner(id, date, diff_app_branch, diff_branch_shift, branch_id), branches!inner(id, code, name)')
        .in('daily_summaries.branch_id', branchIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return {
        sheet: 'exception',
        columns: [
          NO_COL,
          { key: 'sev', label: 'Severity', align: 'center', badge: 'severity' },
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'cabang', label: 'Cabang', badge: 'branch' },
          { key: 'judul', label: 'Temuan' },
          { key: 'deskripsi', label: 'Detail' },
          { key: 'owner', label: 'Owner' },
          { key: 'selisih', label: 'Nominal Varian', align: 'right', money: true, sign: true },
          { key: 'status', label: 'Status', align: 'center', badge: 'status' },
        ],
        rows: (excs ?? []).map((r, i) => ({
          no: i + 1,
          id: r.id,
          summaryId: r.daily_summaries.id,
          sev: r.severity,
          tanggal: dateShort(r.daily_summaries.date),
          cabang: `${r.branches.code} — ${r.branches.name}`,
          judul: r.title,
          deskripsi: r.description,
          owner: r.owner,
          selisih: Math.max(Math.abs(r.daily_summaries.diff_app_branch), Math.abs(r.daily_summaries.diff_branch_shift)) * -1 || null,
          status: r.status,
        })),
      };
    }
    default:
      return null;
  }
}