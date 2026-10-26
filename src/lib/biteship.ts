export function getBiteshipApiKey(): string | null {
  const key = process.env.BITESHIP_API_KEY;
  return key ? key.trim() : null;
}

export function isBiteshipConfigured(): boolean {
  return Boolean(getBiteshipApiKey());
}

export interface BiteshipItem {
  name: string;
  description?: string;
  value: number;
  quantity: number;
  weight?: number;
}

export interface CreateBiteshipOrderParams {
  orderNumber: string;
  destinationContactName: string;
  destinationContactPhone: string;
  destinationAddress: string;
  destinationPostalCode: number | string;
  orderNote?: string;
  items: BiteshipItem[];
}

export interface BiteshipOrderResult {
  biteshipOrderId: string;
  trackingId: string;
  waybillId: string;
  courierCompany: string;
  trackingLink?: string;
}

export async function createBiteshipOrder(
  params: CreateBiteshipOrderParams
): Promise<BiteshipOrderResult> {
  const apiKey = getBiteshipApiKey();
  if (!apiKey) {
    throw new Error('BITESHIP_API_KEY is not configured');
  }

  const endpoint = 'https://api.biteship.com/v1/orders';
  const postalCode = Number(String(params.destinationPostalCode).replace(/\D/g, '')) || 12190;

  const payload = {
    origin_contact_name: 'Sorelle Artisan Living',
    origin_contact_phone: '081234567890',
    origin_address: 'Jl. Kasongan No. 12, Kasihan, Bantul, DI Yogyakarta',
    origin_postal_code: 55184,
    destination_contact_name: params.destinationContactName,
    destination_contact_phone: params.destinationContactPhone,
    destination_address: params.destinationAddress,
    destination_postal_code: postalCode,
    courier_company: 'sicepat',
    courier_type: 'reg',
    delivery_type: 'now',
    order_note: params.orderNote || 'Handle with care - Sorelle Artisan Living',
    metadata: {
      sorelle_order_number: params.orderNumber,
    },
    items: params.items.map((item) => ({
      name: item.name.slice(0, 50),
      description: item.description?.slice(0, 50) || 'Artisan Goods',
      value: Math.round(item.value),
      quantity: item.quantity,
      weight: item.weight || 500,
    })),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.success || !data.id) {
    const errorMsg = data.error || data.message || 'Failed to create Biteship order';
    throw new Error(errorMsg);
  }

  return {
    biteshipOrderId: data.id,
    trackingId: data.courier?.tracking_id || data.id,
    waybillId: data.courier?.waybill_id || `WYB-${Date.now()}`,
    courierCompany: data.courier?.company || 'sicepat',
    trackingLink: data.courier?.link,
  };
}

export async function getBiteshipTracking(trackingIdOrWaybill: string) {
  const apiKey = getBiteshipApiKey();
  if (!apiKey) return null;

  try {
    const endpoint = `https://api.biteship.com/v1/trackings/${encodeURIComponent(trackingIdOrWaybill)}`;
    const response = await fetch(endpoint, {
      headers: {
        Authorization: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data : null;
  } catch (err) {
    console.error('getBiteshipTracking error:', err);
    return null;
  }
}
