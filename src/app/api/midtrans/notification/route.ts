import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyMidtransNotification } from '@/lib/midtrans';
import { createBiteshipOrder, isBiteshipConfigured } from '@/lib/biteship';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    console.error('Webhook failed: supabaseAdmin is not configured');
    return NextResponse.json({ error: 'Database admin is not configured' }, { status: 500 });
  }

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const orderId = String(body.order_id || '');
  const statusCode = String(body.status_code || '');
  const grossAmount = String(body.gross_amount || '');
  const signatureKey = String(body.signature_key || '');
  const transactionStatus = String(body.transaction_status || '');
  const fraudStatus = String(body.fraud_status || '');
  const transactionId = body.transaction_id ? String(body.transaction_id) : null;
  const paymentType = body.payment_type ? String(body.payment_type) : null;

  const isSignatureValid = verifyMidtransNotification({
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signatureKey,
  });

  if (!isSignatureValid) {
    console.warn(`Invalid signature attempt for order: ${orderId}`);
    return NextResponse.json({ error: 'Signature tidak valid' }, { status: 401 });
  }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id,customer_id,status,total_idr')
    .eq('order_number', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    console.warn(`Order not found for notification: ${orderId}`);
    // Acknowledge receipt so Midtrans stops retrying, but do not change any data.
    return NextResponse.json({ ok: true, message: 'Order tidak dikenal, notifikasi diabaikan.' });
  }

  const isPaid =
    transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' && fraudStatus === 'accept');

  if (isPaid) {
    // 1. Update payments table
    await supabaseAdmin.from('payments').upsert(
      {
        order_id: order.id,
        provider: 'midtrans',
        provider_order_id: orderId,
        provider_transaction_id: transactionId,
        status: 'settlement',
        amount_idr: Math.round(Number(grossAmount)),
        payment_type: paymentType,
        fraud_status: fraudStatus,
        paid_at: new Date().toISOString(),
      },
      { onConflict: 'provider_order_id' }
    );

    // 2. Mark order as paid
    await supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // 3. Mark stock reservation as finalized
    await supabaseAdmin
      .from('order_stock_reservations')
      .update({ released_at: new Date().toISOString() })
      .eq('order_id', order.id);

    // 4. Grant +500 loyalty reward if not yet given
    const { data: existingReward } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('id')
      .eq('order_id', order.id)
      .eq('reason', 'purchase')
      .maybeSingle();

    if (!existingReward) {
      await supabaseAdmin.from('loyalty_transactions').insert({
        customer_id: order.customer_id,
        order_id: order.id,
        points: 500,
        reason: 'purchase',
      });

      const { data: account } = await supabaseAdmin
        .from('loyalty_accounts')
        .select('balance')
        .eq('customer_id', order.customer_id)
        .maybeSingle();

      if (account) {
        await supabaseAdmin
          .from('loyalty_accounts')
          .update({
            balance: account.balance + 500,
            updated_at: new Date().toISOString(),
          })
          .eq('customer_id', order.customer_id);
      }
    }

    // 5. Create shipment via Biteship Sandbox if configured
    if (isBiteshipConfigured()) {
      try {
        const { data: orderDetails } = await supabaseAdmin
          .from('orders')
          .select('order_number,shipping_name,shipping_phone,shipping_address,customer_note,order_items(product_name,unit_price_idr,quantity)')
          .eq('id', order.id)
          .single();

        if (orderDetails) {
          const addr = orderDetails.shipping_address as Record<string, unknown> | null;
          const fullAddress = `${addr?.street || ''}, ${addr?.city || ''}, ${addr?.province || ''}`.trim() || 'Jakarta';
          const postal = addr?.postalCode ? String(addr.postalCode) : '12190';
          const rawItems = orderDetails.order_items as unknown[];
          const items = Array.isArray(rawItems) && rawItems.length > 0
            ? rawItems.map((item) => {
                const i = item as { product_name?: string; unit_price_idr?: number; quantity?: number };
                return {
                  name: i.product_name || 'Produk Artisan',
                  value: i.unit_price_idr || 100000,
                  quantity: i.quantity || 1,
                };
              })
            : [{ name: 'Produk Artisan Sorelle', value: 100000, quantity: 1 }];

          const shipment = await createBiteshipOrder({
            orderNumber: orderDetails.order_number,
            destinationContactName: orderDetails.shipping_name,
            destinationContactPhone: orderDetails.shipping_phone,
            destinationAddress: fullAddress,
            destinationPostalCode: postal,
            orderNote: orderDetails.customer_note || undefined,
            items,
          });

          await supabaseAdmin
            .from('orders')
            .update({
              courier: `SiCepat Reguler`,
              tracking_number: shipment.waybillId,
              status: 'processing',
            })
            .eq('id', order.id);

          await supabaseAdmin.from('shipment_events').insert({
            order_id: order.id,
            status: 'confirmed',
            description: `Pesanan telah dikonfirmasi. Kurir SiCepat ditugaskan untuk pickup (Resi: ${shipment.waybillId}).`,
            location: 'Sorelle Studio (Bantul)',
            event_at: new Date().toISOString(),
          });
        }
      } catch (shippingErr) {
        console.error('Biteship order creation failed:', shippingErr);
      }
    }
  } else if (['deny', 'cancel', 'expire'].includes(transactionStatus)) {
    const paymentStatus = transactionStatus as 'deny' | 'cancel' | 'expire';

    await supabaseAdmin.from('payments').upsert(
      {
        order_id: order.id,
        provider: 'midtrans',
        provider_order_id: orderId,
        provider_transaction_id: transactionId,
        status: paymentStatus,
        amount_idr: Math.round(Number(grossAmount)),
        payment_type: paymentType,
        fraud_status: fraudStatus,
      },
      { onConflict: 'provider_order_id' }
    );

    if (order.status === 'pending_payment') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);

      // Return reserved stock
      const { data: reservations } = await supabaseAdmin
        .from('order_stock_reservations')
        .select('product_id,quantity')
        .eq('order_id', order.id)
        .is('released_at', null);

      if (reservations && reservations.length > 0) {
        for (const item of reservations) {
          const { data: product } = await supabaseAdmin
            .from('products')
            .select('stock')
            .eq('id', item.product_id)
            .single();

          if (product) {
            await supabaseAdmin
              .from('products')
              .update({ stock: product.stock + item.quantity })
              .eq('id', item.product_id);
          }
        }

        await supabaseAdmin
          .from('order_stock_reservations')
          .update({ released_at: new Date().toISOString() })
          .eq('order_id', order.id)
          .is('released_at', null);
      }
    }
  } else if (transactionStatus === 'pending') {
    await supabaseAdmin.from('payments').upsert(
      {
        order_id: order.id,
        provider: 'midtrans',
        provider_order_id: orderId,
        provider_transaction_id: transactionId,
        status: 'pending',
        amount_idr: Math.round(Number(grossAmount)),
        payment_type: paymentType,
        fraud_status: fraudStatus,
      },
      { onConflict: 'provider_order_id' }
    );
  }

  return NextResponse.json({ ok: true });
}
