import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database admin not configured' }, { status: 500 });
  }

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const courierWaybillId = body.courier_waybill_id ? String(body.courier_waybill_id) : null;
  const courierTrackingId = body.courier_tracking_id ? String(body.courier_tracking_id) : null;
  const status = String(body.status || '');
  const driverName = body.courier_driver_name ? String(body.courier_driver_name) : null;
  const courierCompany = body.courier_company ? String(body.courier_company) : 'SiCepat';
  const updatedAt = body.updated_at ? String(body.updated_at) : new Date().toISOString();

  // Find order by tracking_number or courier tracking id
  let orderQuery = supabaseAdmin.from('orders').select('id,order_number,status');

  if (courierWaybillId) {
    orderQuery = orderQuery.eq('tracking_number', courierWaybillId);
  } else if (courierTrackingId) {
    orderQuery = orderQuery.eq('tracking_number', courierTrackingId);
  } else {
    return NextResponse.json({ message: 'No tracking identifier provided' }, { status: 200 });
  }

  const { data: order } = await orderQuery.maybeSingle();
  if (!order) {
    return NextResponse.json({ message: 'Order not found for tracking id' }, { status: 200 });
  }

  const statusDescriptions: Record<string, string> = {
    allocated: `Kurir ${courierCompany.toUpperCase()} (${driverName || 'Petugas'}) telah ditugaskan.`,
    picking_up: `Kurir sedang menuju studio artisan untuk mengambil paket.`,
    picked: `Paket telah diambil oleh kurir dan dalam perjalanan ke hub logistik.`,
    dropping_off: `Kurir ${driverName ? `(${driverName})` : ''} sedang menuju alamat tujuan untuk mengantar paket.`,
    delivered: `Paket telah sampai di alamat tujuan dan diterima dengan baik.`,
    cancelled: `Pengiriman dibatalkan.`,
  };

  const description = statusDescriptions[status] || `Status pengiriman diperbarui: ${status}`;

  // Insert checkpoint into shipment_events
  await supabaseAdmin.from('shipment_events').insert({
    order_id: order.id,
    status: status || 'update',
    description,
    location: status === 'delivered' ? 'Alamat Tujuan' : 'Dalam Perjalanan',
    event_at: updatedAt,
  });

  // Update order status accordingly
  if (status === 'picked' && order.status !== 'shipped' && order.status !== 'delivered') {
    await supabaseAdmin.from('orders').update({ status: 'shipped' }).eq('id', order.id);
  } else if (status === 'delivered') {
    await supabaseAdmin
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: updatedAt,
      })
      .eq('id', order.id);
  }

  return NextResponse.json({ ok: true });
}
