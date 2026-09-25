import { supabase } from '@/lib/supabase';
import { getDetail } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function digest(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `0x${(h >>> 0).toString(16).padStart(8, '0')}${((h ^ 0xabcdef) >>> 0).toString(16).padStart(8, '0')}`.slice(0, 18);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const detail = await getDetail(Number(id));
    if (!detail) return Response.json({ error: 'Summary tidak ditemukan' }, { status: 404 });
    return Response.json(detail);
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Gagal memuat detail' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const summaryId = Number(id);
    const body = (await req.json()) as { action?: string; note?: string };

    const { data: summary, error: summaryError } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();
    if (summaryError || !summary) return Response.json({ error: 'Summary tidak ditemukan' }, { status: 404 });

    const { data: lastLog } = await supabase
      .from('audit_logs')
      .select('hash')
      .order('id', { ascending: true })
      .limit(1)
      .single();

    if (body.action === 'resolve') {
      await supabase.from('exceptions').update({ status: 'RESOLVED' }).eq('summary_id', summaryId);
      await supabase.from('daily_summaries').update({ status: 'CLOSED' }).eq('id', summaryId);
      const prevHash = lastLog?.hash ?? digest('genesis-dentico');
      await supabase.from('audit_logs').insert({
        summary_id: summaryId,
        action: 'RESOLVED_CLOSED',
        actor: 'Siti Rahmawati',
        role: 'Finance Controller',
        detail: 'Selisih diverifikasi controller — penyesuaian dicatat di Reconciliation, exception ditutup & sheet dikunci.',
        hash: digest(`${prevHash}RESOLVED_CLOSED${summaryId}${Date.now()}`),
        prev_hash: prevHash,
        verified: true,
      });
    } else if (body.action === 'note' && body.note) {
      const prevHash = lastLog?.hash ?? digest('genesis-dentico');
      await supabase.from('audit_logs').insert({
        summary_id: summaryId,
        action: 'CONTROLLER_NOTE',
        actor: 'Siti Rahmawati',
        role: 'Finance Controller',
        detail: body.note.slice(0, 400),
        hash: digest(`${prevHash}NOTE${summaryId}${Date.now()}`),
        prev_hash: prevHash,
        verified: true,
      });
    } else if (body.action === 'reopen') {
      await supabase.from('daily_summaries').update({ status: 'OPEN' }).eq('id', summaryId);
    } else {
      return Response.json({ error: 'Aksi tidak dikenal' }, { status: 400 });
    }

    const detail = await getDetail(summaryId);
    return Response.json(detail);
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Gagal menjalankan aksi' }, { status: 500 });
  }
}