import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Some providers, including Biteship, validate a webhook URL by sending an
 * empty request (or a GET) and expecting HTTP 200. Both handlers below
 * acknowledge such probes safely without touching any data.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  // Read the body as text first so an empty or non-JSON probe is still acknowledged.
  const rawBody = await request.text().catch(() => '');
  if (!rawBody.trim()) {
    return NextResponse.json({ ok: true });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ ok: true });
  }

  if (!supabaseAdmin) {
    console.error('Biteship webhook: Supabase admin client is not configured');
    return NextResponse.json({ ok: true });
  }

  const body = payload as Record<string, unknown>;
  const courierWaybillId = body.courier_waybill_id ? String(body.courier_waybill_id) : null;
  const courierTrackingId = body.courier_tracking_id ? String(body.courier_tracking_id) : null;
  const status = String(body.status || '');
  const driverName = body.courier_driver_name ? String(body.courier_driver_name) : null;
  const courierCompany = body.courier_company ? String(body.courier_company) : 'SiCepat';
  const updatedAt = body.updated_at ? String(body.updated_at) : new Date().toISOString();

  if (!courierWaybillId && !courierTrackingId) {
    return NextResponse.json({ ok: true });
  }

  let orderQuery = supabaseAdmin.from('orders').select('id,order_number,status');
  orderQuery = courierWaybillId
    ? orderQuery.eq('tracking_number', courierWaybillId)
    : orderQuery.eq('tracking_number', courierTrackingId as string);

  const { data: order, error: orderError } = await orderQuery.maybeSingle();
  if (orderError) {
    console.error('Biteship webhook order lookup failed:', orderError.message);
    return NextResponse.json({ ok: true });
  }
  if (!order) {
    // Unknown tracking id: acknowledge so Biteship does not retry, change nothing.
    return NextResponse.json({ ok: true });
  }

  const statusDescriptions: Record<string, string> = {
    allocated: `Kurir ${courierCompany.toUpperCase()} (${driverName || 'Petugas'}) telah ditugaskan.`,
    picking_up: 'Kurir sedang menuju studio artisan untuk mengambil paket.',
    picked: 'Paket telah diambil oleh kurir dan dalam perjalanan ke hub logistik.',
    dropping_off: `Kurir ${driverName ? `(${driverName}) ` : ''}sedang menuju alamat tujuan untuk mengantar paket.`,
    delivered: 'Paket telah sampai di alamat tujuan dan diterima dengan baik.',
    cancelled: 'Pengiriman dibatalkan.',
  };

  const description = statusDescriptions[status] || `Status pengiriman diperbarui: ${status}`;

  const { error: eventError } = await supabaseAdmin.from('shipment_events').insert({
    order_id: order.id,
    status: status || 'update',
    description,
    location: status === 'delivered' ? 'Alamat Tujuan' : 'Dalam Perjalanan',
    event_at: updatedAt,
  });
  if (eventError) console.error('Biteship webhook event insert failed:', eventError.message);

  if (status === 'picked' && order.status !== 'shipped' && order.status !== 'delivered') {
    await supabaseAdmin.from('orders').update({ status: 'shipped' }).eq('id', order.id);
  } else if (status === 'delivered') {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'delivered', delivered_at: updatedAt })
      .eq('id', order.id);
  }

  return NextResponse.json({ ok: true });
}