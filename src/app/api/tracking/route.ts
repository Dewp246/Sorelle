import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getBiteshipTracking } from '@/lib/biteship';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token) return NextResponse.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 });
  if (!url || !anonKey) return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 500 });

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await client.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber');

  // If orderNumber is given, fetch specific order. Otherwise fetch latest active order.
  let orderQuery = client
    .from('orders')
    .select('id,order_number,status,courier,tracking_number,shipping_name,shipping_phone,shipping_address,created_at,delivered_at')
    .eq('customer_id', user.id);

  if (orderNumber) {
    orderQuery = orderQuery.eq('order_number', orderNumber.trim());
  } else {
    orderQuery = orderQuery.order('created_at', { ascending: false }).limit(1);
  }

  const { data: orders, error: orderError } = await orderQuery;
  if (orderError || !orders || orders.length === 0) {
    return NextResponse.json({ order: null, checkpoints: [] });
  }

  const order = orders[0];

  // Fetch checkpoints from shipment_events
  const { data: events } = await client
    .from('shipment_events')
    .select('id,status,description,location,event_at')
    .eq('order_id', order.id)
    .order('event_at', { ascending: false });

  // Optional: check Biteship tracking if tracking_number exists
  let biteshipData = null;
  if (order.tracking_number) {
    biteshipData = await getBiteshipTracking(order.tracking_number);
  }

  return NextResponse.json({
    order,
    checkpoints: events || [],
    biteship: biteshipData,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token) return NextResponse.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 });
  if (!url || !anonKey || !supabaseAdmin) return NextResponse.json({ error: 'Server belum siap.' }, { status: 500 });

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await client.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  const payload: unknown = await request.json().catch(() => null);
  const { orderId } = (payload || {}) as { orderId?: string };

  if (!orderId) {
    return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 });
  }

  // Verify ownership
  const { data: order } = await client
    .from('orders')
    .select('id,order_number,status,courier,tracking_number')
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .single();

  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
  }

  // Count existing shipment events to determine next simulation step
  const { data: existingEvents } = await supabaseAdmin
    .from('shipment_events')
    .select('id,status')
    .eq('order_id', order.id);

  const count = existingEvents?.length || 0;

  const simulationSteps = [
    {
      status: 'allocated',
      description: 'Kurir SiCepat (Budi Santoso) telah ditugaskan dan menuju studio artisan.',
      location: 'Sorelle Studio (Bantul)',
      orderStatus: 'processing',
    },
    {
      status: 'picked',
      description: 'Paket telah dijemput oleh kurir SiCepat dan dalam perjalanan ke Hub Sortir.',
      location: 'Kasihan, Bantul',
      orderStatus: 'shipped',
    },
    {
      status: 'hub',
      description: 'Paket tiba di Hub Sortir Regional Jakarta Selatan untuk disortir.',
      location: 'Hub Sortir Jaksel',
      orderStatus: 'shipped',
    },
    {
      status: 'dropping_off',
      description: 'Kurir Budi Santoso sedang dalam perjalanan mengantar paket ke alamat tujuan.',
      location: 'Kebayoran Baru, Jakarta Selatan',
      orderStatus: 'shipped',
    },
    {
      status: 'delivered',
      description: 'Paket telah sampai di alamat tujuan dan diterima dengan baik.',
      location: 'Alamat Tujuan (Siti Rahma)',
      orderStatus: 'delivered',
    },
  ];

  const stepIndex = Math.min(count, simulationSteps.length - 1);
  const nextStep = simulationSteps[stepIndex];

  // If tracking_number is not set yet, set one
  const trackingNumber = order.tracking_number || `BITESHIP-TEST-${Date.now().toString().slice(-6)}`;
  const courier = order.courier || 'SiCepat Reguler';

  await supabaseAdmin
    .from('orders')
    .update({
      courier,
      tracking_number: trackingNumber,
      status: nextStep.orderStatus,
      ...(nextStep.status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq('id', order.id);

  await supabaseAdmin.from('shipment_events').insert({
    order_id: order.id,
    status: nextStep.status,
    description: nextStep.description,
    location: nextStep.location,
    event_at: new Date().toISOString(),
  });

  return NextResponse.json({
    message: `Checkpoint ditambahkan: ${nextStep.description}`,
    status: nextStep.orderStatus,
  });
}
