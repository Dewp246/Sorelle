import crypto from 'node:crypto';

export function isMidtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY && process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY);
}

export function isMidtransProduction(): boolean {
  return process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
}

export function getSnapBaseUrl(): string {
  return isMidtransProduction()
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com';
}

export function getSnapScriptUrl(): string {
  return `${getSnapBaseUrl()}/snap/snap.js`;
}

export interface SnapTransactionParams {
  orderId: string;
  grossAmount: number;
  customerDetails?: {
    first_name?: string;
    email?: string;
    phone?: string;
  };
  itemDetails?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
}

export interface SnapTransactionResult {
  token: string;
  redirect_url: string;
}

export async function createSnapTransaction(
  params: SnapTransactionParams
): Promise<SnapTransactionResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY is not configured');
  }

  const endpoint = `${getSnapBaseUrl()}/snap/v1/transactions`;
  const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;

  const payload = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: Math.round(params.grossAmount),
    },
    item_details: params.itemDetails?.map((item) => ({
      id: item.id.slice(0, 50),
      price: Math.round(item.price),
      quantity: item.quantity,
      name: item.name.slice(0, 50),
    })),
    customer_details: params.customerDetails,
    expiry: {
      unit: 'minute',
      duration: 15,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.token) {
    const errorMsg = Array.isArray(data.error_messages)
      ? data.error_messages.join(', ')
      : data.message || 'Failed to create Snap transaction';
    throw new Error(errorMsg);
  }

  return {
    token: data.token,
    redirect_url: data.redirect_url,
  };
}

export function verifyMidtransNotification(body: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey || !body.signature_key) return false;

  const raw = `${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`;
  const computedHash = crypto.createHash('sha512').update(raw).digest('hex').toLowerCase();
  const providedHash = body.signature_key.toLowerCase();

  if (computedHash.length !== providedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(providedHash));
}
