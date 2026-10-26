import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSnapTransaction, isMidtransConfigured } from '@/lib/midtrans';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token) return NextResponse.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 });
  if (!url || !anonKey) return NextResponse.json({ error: 'Konfigurasi Supabase belum lengkap.' }, { status: 500 });
  if (!isMidtransConfigured()) return NextResponse.json({ error: 'Midtrans belum dikonfigurasi.' }, { status: 503 });

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Data permintaan tidak valid.' }, { status: 400 });
  }
  const { orderNumber } = payload as { orderNumber?: unknown };
  if (typeof orderNumber !== 'string' || !orderNumber.trim()) {
    return NextResponse.json({ error: 'Nomor pesanan harus diisi.' }, { status: 400 });
  }

  // Fetch the order ensuring it belongs to the authenticated user
  const { data: order, error: orderError } = await client
    .from('orders')
    .select('id,order_number,status,total_idr,shipping_name,shipping_phone,created_at')
    .eq('order_number', orderNumber.trim())
    .eq('customer_id', user.id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
  }

  if (order.status !== 'pending_payment') {
    return NextResponse.json({ error: `Pesanan berstatus ${order.status}, tidak dapat dibayar.` }, { status: 400 });
  }

  // Check 15 minute expiration
  const orderTime = new Date(order.created_at).getTime();
  const now = Date.now();
  if (now - orderTime > 15 * 60 * 1000) {
    return NextResponse.json({ error: 'Reservasi pesanan telah kedaluwarsa. Silakan checkout kembali.' }, { status: 410 });
  }

  try {
    const snap = await createSnapTransaction({
      orderId: order.order_number,
      grossAmount: order.total_idr,
      customerDetails: {
        first_name: order.shipping_name,
        phone: order.shipping_phone,
        email: user.email,
      },
    });

    if (supabaseAdmin) {
      await supabaseAdmin.from('payments').upsert({
        order_id: order.id,
        provider: 'midtrans',
        provider_order_id: order.order_number,
        status: 'pending',
        amount_idr: order.total_idr,
      }, { onConflict: 'provider_order_id' });
    }

    return NextResponse.json({
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Failed to create snap token:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Gagal membuat sesi pembayaran.',
    }, { status: 502 });
  }
}
