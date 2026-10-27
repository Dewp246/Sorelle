import { NextResponse } from 'next/server';
import { FREE_SHIPPING_THRESHOLD_IDR, availableCouriers, shippingCostIdr, zoneFromProvince, zoneLabel } from '@/lib/shipping';

export const runtime = 'nodejs';

/**
 * Preview shipping options for a destination province.
 * The database recalculates the final value in create_order; this endpoint is
 * only for the checkout UI.
 */
export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const subtotalIdr = Number(body.subtotalIdr);
  const province = typeof body.province === 'string' ? body.province : '';

  if (!Number.isFinite(subtotalIdr) || subtotalIdr < 0) {
    return NextResponse.json({ error: 'Subtotal tidak valid.' }, { status: 400 });
  }

  const zone = zoneFromProvince(province);
  const freeShipping = subtotalIdr >= FREE_SHIPPING_THRESHOLD_IDR;

  const options = availableCouriers(province).map((courier) => ({
    id: courier.id,
    label: courier.label,
    service: courier.service,
    estimate: courier.estimate,
    priceIdr: shippingCostIdr(subtotalIdr, province, courier.id),
  }));

  return NextResponse.json({
    zone,
    zoneLabel: zoneLabel(zone),
    freeShipping,
    options,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
