import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSnapTransaction, isMidtransConfigured } from '@/lib/midtrans';
import { DEFAULT_COURIER_ID, getCourier as getCourierOrNull } from '@/lib/shipping';

export const runtime = 'nodejs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Maximum number of orders returned per history request. Row level security
 * already scopes every read to the caller; this only keeps the payload bounded.
 */
const HISTORY_LIMIT = 30;

/** Columns needed to render the account order list and its detail summary. */
const ORDER_SELECT =
  'id,order_number,status,subtotal_idr,shipping_idr,discount_idr,total_idr,courier,tracking_number,customer_note,shipping_name,shipping_phone,shipping_address,paid_at,delivered_at,created_at,order_items(id,product_id,product_name,unit_price_idr,quantity,line_total_idr,products(image_url))';

type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price_idr: number;
  quantity: number;
  line_total_idr: number;
  products: { image_url: string | null } | { image_url: string | null }[] | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  subtotal_idr: number;
  shipping_idr: number;
  discount_idr: number;
  total_idr: number;
  courier: string | null;
  tracking_number: string | null;
  customer_note: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: Record<string, unknown> | null;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
  order_items: OrderItemRow[] | null;
};

/** Embedded relations may be returned as an object or a single-element array. */
function productImageUrl(relation: OrderItemRow['products']): string | null {
  if (Array.isArray(relation)) return relation[0]?.image_url ?? null;
  return relation?.image_url ?? null;
}

/**
 * Order history for the signed-in customer.
 *
 * GET /api/orders               → the most recent orders of the caller
 * GET /api/orders?orderNumber=… → a single order of the caller
 *
 * Auth mirrors /api/tracking: the caller's Supabase access token is forwarded as
 * a bearer token, and row level security restricts reads to their own orders.
 */
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
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber')?.trim();

  let query = client
    .from('orders')
    .select(ORDER_SELECT)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  query = orderNumber ? query.eq('order_number', orderNumber).limit(1) : query.limit(HISTORY_LIMIT);

  const { data, error } = await query;
  if (error) {
    console.error('order history query failed', { code: error.code, message: error.message });
    return NextResponse.json({ error: 'Riwayat pesanan belum dapat dimuat.' }, { status: 503 });
  }

  const orders = ((data ?? []) as unknown as OrderRow[]).map((row) => ({
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    subtotal_idr: row.subtotal_idr,
    shipping_idr: row.shipping_idr,
    discount_idr: row.discount_idr,
    total_idr: row.total_idr,
    courier: row.courier,
    tracking_number: row.tracking_number,
    customer_note: row.customer_note,
    shipping_name: row.shipping_name,
    shipping_phone: row.shipping_phone,
    shipping_address: row.shipping_address ?? {},
    paid_at: row.paid_at,
    delivered_at: row.delivered_at,
    created_at: row.created_at,
    items: (row.order_items ?? []).map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      unit_price_idr: item.unit_price_idr,
      quantity: item.quantity,
      line_total_idr: item.line_total_idr,
      image_url: productImageUrl(item.products),
    })),
  }));

  return NextResponse.json({
    orders,
    limit: HISTORY_LIMIT,
    hasMore: !orderNumber && orders.length === HISTORY_LIMIT,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token) return NextResponse.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 });
  if (!url || !anonKey) return NextResponse.json({ error: 'Konfigurasi Supabase belum lengkap.' }, { status: 500 });

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Sesi tidak valid. Silakan masuk lagi.' }, { status: 401 });

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || !('items' in payload) || !Array.isArray(payload.items)) {
    return NextResponse.json({ error: 'Data checkout tidak valid.' }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return NextResponse.json({ error: 'Keranjang harus berisi 1–50 produk.' }, { status: 400 });
  }
  if (typeof body.idempotencyKey !== 'string' || !uuidPattern.test(body.idempotencyKey)) {
    return NextResponse.json({ error: 'Kunci permintaan tidak valid. Coba ulang checkout.' }, { status: 400 });
  }
  if (typeof body.shippingName !== 'string' || body.shippingName.trim().length < 2 || body.shippingName.trim().length > 120
    || typeof body.shippingPhone !== 'string' || body.shippingPhone.trim().length < 6 || body.shippingPhone.trim().length > 30
    || !body.shippingAddress || typeof body.shippingAddress !== 'object' || Array.isArray(body.shippingAddress)) {
    return NextResponse.json({ error: 'Nama, nomor telepon, atau alamat pengiriman tidak valid.' }, { status: 400 });
  }
  const address = body.shippingAddress as Record<string, unknown>;
  if (Object.values(address).some((value) => typeof value !== 'string' || value.length > 250)
    || !['street', 'city', 'province', 'postalCode'].every((key) => typeof address[key] === 'string' && (address[key] as string).trim().length > 0)) {
    return NextResponse.json({ error: 'Alamat harus mencantumkan jalan, kota, provinsi, dan kode pos.' }, { status: 400 });
  }
  if (body.customerNote !== undefined && (typeof body.customerNote !== 'string' || body.customerNote.length > 1000)) {
    return NextResponse.json({ error: 'Catatan pesanan tidak valid.' }, { status: 400 });
  }
  const courierId = typeof body.courierId === 'string' ? body.courierId.trim() : '';
  if (!getCourierOrNull(courierId)) {
    return NextResponse.json({ error: 'Pilihan kurir tidak dikenal.' }, { status: 400 });
  }
  const seen = new Set<string>();
  for (const item of body.items) {
    if (!item || typeof item !== 'object' || !('productId' in item) || !('quantity' in item)) {
      return NextResponse.json({ error: 'Format produk tidak valid.' }, { status: 400 });
    }
    const { productId, quantity } = item as { productId: unknown; quantity: unknown };
    if (typeof productId !== 'string' || !uuidPattern.test(productId) || !Number.isSafeInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 50 || seen.has(productId)) {
      return NextResponse.json({ error: 'ID produk atau jumlah tidak valid.' }, { status: 400 });
    }
    seen.add(productId);
  }

  const { data, error } = await client.rpc('create_order', {
    p_idempotency_key: body.idempotencyKey,
    p_items: body.items,
    p_shipping_name: body.shippingName.trim(),
    p_shipping_phone: body.shippingPhone.trim(),
    p_shipping_address: address,
    p_customer_note: typeof body.customerNote === 'string' ? body.customerNote.trim() || null : null,
    p_courier: courierId || DEFAULT_COURIER_ID,
  });
  if (error) {
    if (error.code === 'P0001' || error.code === 'P0002') return NextResponse.json({ error: error.message }, { status: 409 });
    if (error.code === '22023' || error.code === '22003') return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('create_order failed', { code: error.code, message: error.message });
    return NextResponse.json({ error: 'Pesanan belum dapat dibuat. Coba kembali.' }, { status: 503 });
  }

  let snapToken: string | null = null;
  let snapRedirectUrl: string | null = null;
  let paymentError: string | null = null;

  if (isMidtransConfigured()) {
    try {
      const snap = await createSnapTransaction({
        orderId: data.orderNumber,
        grossAmount: data.totalIdr,
        customerDetails: {
          first_name: body.shippingName.trim(),
          phone: body.shippingPhone.trim(),
          email: user.email,
        },
      });
      snapToken = snap.token;
      snapRedirectUrl = snap.redirect_url;

      if (supabaseAdmin) {
        await supabaseAdmin.from('payments').upsert({
          order_id: data.orderId,
          provider: 'midtrans',
          provider_order_id: data.orderNumber,
          status: 'pending',
          amount_idr: data.totalIdr,
        }, { onConflict: 'provider_order_id' });
      }
    } catch (paymentErr) {
      console.error('Midtrans Snap creation error:', paymentErr);
      paymentError = paymentErr instanceof Error ? paymentErr.message : 'Gagal membuat sesi pembayaran Midtrans';
    }
  }

  return NextResponse.json({
    ...data,
    snapToken,
    snapRedirectUrl,
    paymentError,
  }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
