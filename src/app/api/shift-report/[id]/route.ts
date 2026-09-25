import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const rowId = Number(id);
    if (isNaN(rowId)) return Response.json({ error: 'Invalid id' }, { status: 400 });

    const body = (await req.json()) as {
      qrisAmount?: number;
      transferAmount?: number;
      edcAmount?: number;
      cashAmount?: number;
      note?: string;
    };

    const { data: current, error: currentError } = await supabase
      .from('shift_reports')
      .select('*')
      .eq('id', rowId)
      .single();
    if (currentError || !current) return Response.json({ error: 'Row not found' }, { status: 404 });

    const qris = body.qrisAmount ?? current.qris_amount;
    const transfer = body.transferAmount ?? current.transfer_amount;
    const edc = body.edcAmount ?? current.edc_amount;
    const cash = body.cashAmount ?? current.cash_amount;
    const physical = qris + transfer + edc + cash;
    const variance = physical - current.expected_amount;
    const status = variance === 0 ? 'MATCH' : variance > 0 ? 'OVER' : 'UNDER';

    const { data: updated, error: updateError } = await supabase
      .from('shift_reports')
      .update({
        qris_amount: qris,
        transfer_amount: transfer,
        edc_amount: edc,
        cash_amount: cash,
        physical_amount: physical,
        variance,
        status,
        note: body.note ?? current.note,
      })
      .eq('id', rowId)
      .select()
      .single();

    if (updateError) throw updateError;

    return Response.json(updated);
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Gagal menyimpan' }, { status: 500 });
  }
}