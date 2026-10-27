-- Zone-based shipping estimate (offline alternative to Biteship rates API).
-- Keeps the same signature as before so the Next.js route does not change shape,
-- but adds p_courier and recalculates shipping from the destination province.
--
-- Keep ZONE_* lists in sync with src/lib/shipping.ts.

create or replace function public.sorelle_shipping_zone(p_province text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(trim(p_province), '') = '' then 2
    when lower(p_province) similar to '%(maluku|papua|nusa tenggara timur|ntt)%' then 3
    when lower(p_province) similar to '%(dki jakarta|jakarta|jawa barat|jawa tengah|jawa timur|banten|yogyakarta|bali)%' then 1
    else 2
  end
$$;

create or replace function public.sorelle_shipping_cost_idr(p_subtotal bigint, p_province text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_subtotal >= 500000 then 0
    when public.sorelle_shipping_zone(p_province) = 1 then 18000
    when public.sorelle_shipping_zone(p_province) = 3 then 45000
    else 32000
  end
$$;

-- create_order: same contract plus an optional courier argument.
create or replace function public.create_order(
  p_idempotency_key uuid,
  p_items jsonb,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address jsonb,
  p_customer_note text default null,
  p_courier text default 'sicepat_reg'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_item jsonb;
  v_product record;
  v_order_id uuid;
  v_order_number text;
  v_quantity integer;
  v_subtotal bigint := 0;
  v_shipping bigint;
  v_total bigint;
  v_courier text := coalesce(nullif(trim(p_courier), ''), 'sicepat_reg');
  v_courier_record record;
  v_province text;
  v_existing public.orders%rowtype;
  v_expires_at timestamptz := now() + interval '15 minutes';
begin
  if v_customer_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Idempotency key is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception using errcode = '22023', message = 'Cart must contain 1 to 50 items';
  end if;
  if p_shipping_name is null or length(trim(p_shipping_name)) not between 2 and 120
     or p_shipping_phone is null or length(trim(p_shipping_phone)) not between 6 and 30
     or p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object'
     or length(coalesce(p_customer_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'Invalid shipping information';
  end if;

  select * into v_courier_record from (values
    ('anteraja_reg', 'AnterAja', 'Reguler', '3–5 hari', 0.95, false),
    ('sicepat_reg', 'SiCepat', 'Reguler', '2–4 hari', 1.00, false),
    ('jnt_express', 'J&T Express', 'Reguler', '2–4 hari', 1.05, false),
    ('jne_reg', 'JNE', 'Reguler', '2–4 hari', 1.10, false),
    ('grab_sameday', 'Grab', 'Same Day', 'Hari ini', 1.60, true)
  ) as c(id, label, service, estimate, multiplier, zone1_only)
  where c.id = v_courier;

  if not found then
    raise exception using errcode = '22023', message = 'Unknown courier';
  end if;

  v_province := coalesce(p_shipping_address ->> 'province', '');
  if v_courier_record.zone1_only and public.sorelle_shipping_zone(v_province) <> 1 then
    raise exception using errcode = '22023', message = 'Courier does not serve this destination';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text || p_idempotency_key::text, 0));
  select * into v_existing from public.orders
    where customer_id = v_customer_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'orderId', v_existing.id,
      'orderNumber', v_existing.order_number,
      'status', v_existing.status,
      'subtotalIdr', v_existing.subtotal_idr,
      'shippingIdr', v_existing.shipping_idr,
      'totalIdr', v_existing.total_idr,
      'courier', v_existing.courier,
      'reservationExpiresAt', (select min(r.expires_at) from public.order_stock_reservations r where r.order_id = v_existing.id and r.released_at is null),
      'idempotentReplay', true
    );
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as x(item)
    where jsonb_typeof(x.item) <> 'object'
       or coalesce(x.item->>'productId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(x.item->>'quantity', '') !~ '^[1-9][0-9]*$'
       or (x.item->>'quantity')::numeric > 50
  ) then
    raise exception using errcode = '22023', message = 'Invalid product id or quantity';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct lower(x.item->>'productId')) from jsonb_array_elements(p_items) as x(item)) then
    raise exception using errcode = '22023', message = 'Duplicate products are not allowed';
  end if;
  if (select sum((x.item->>'quantity')::numeric) from jsonb_array_elements(p_items) as x(item)) > 250 then
    raise exception using errcode = '22023', message = 'Total quantity exceeds limit';
  end if;

  v_order_number := 'SOR-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.orders (
    order_number, customer_id, idempotency_key, status,
    subtotal_idr, shipping_idr, discount_idr, total_idr,
    shipping_name, shipping_phone, shipping_address, customer_note, courier
  ) values (
    v_order_number, v_customer_id, p_idempotency_key, 'pending_payment',
    0, 0, 0, 0, trim(p_shipping_name), trim(p_shipping_phone), p_shipping_address,
    nullif(trim(coalesce(p_customer_note, '')), ''), v_courier
  ) returning id into v_order_id;

  for v_item in
    select x.item from jsonb_array_elements(p_items) as x(item)
    order by (x.item->>'productId')::uuid
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select p.id, p.store_id, p.name, p.price_idr, p.stock
      into v_product
      from public.products p
      join public.stores s on s.id = p.store_id and s.status = 'active'
      where p.id = (v_item->>'productId')::uuid and p.status = 'active'
      for update of p;

    if not found then
      raise exception using errcode = 'P0002', message = 'A product is unavailable';
    end if;
    if v_product.stock < v_quantity then
      raise exception using errcode = 'P0001', message = 'Insufficient stock for ' || v_product.name;
    end if;
    if v_product.price_idr::bigint * v_quantity > 2000000000 then
      raise exception using errcode = '22003', message = 'Product line total exceeds supported amount';
    end if;

    update public.products set stock = stock - v_quantity where id = v_product.id;
    insert into public.order_items (
      order_id, product_id, store_id, product_name,
      unit_price_idr, quantity, line_total_idr
    ) values (
      v_order_id, v_product.id, v_product.store_id, v_product.name,
      v_product.price_idr, v_quantity, v_product.price_idr * v_quantity
    );
    insert into public.order_stock_reservations(order_id, product_id, quantity, expires_at)
      values (v_order_id, v_product.id, v_quantity, v_expires_at);
    v_subtotal := v_subtotal + v_product.price_idr::bigint * v_quantity;
    if v_subtotal > 2000000000 then
      raise exception using errcode = '22003', message = 'Order total exceeds supported amount';
    end if;
  end loop;

  v_shipping := round(public.sorelle_shipping_cost_idr(v_subtotal, v_province) * v_courier_record.multiplier / 500) * 500;
  if v_subtotal >= 500000 then
    v_shipping := 0;
  end if;
  v_total := v_subtotal + v_shipping;
  if v_total > 2000000000 then
    raise exception using errcode = '22003', message = 'Order total exceeds supported amount';
  end if;
  update public.orders set subtotal_idr = v_subtotal, shipping_idr = v_shipping, total_idr = v_total
    where id = v_order_id;

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'status', 'pending_payment',
    'subtotalIdr', v_subtotal,
    'shippingIdr', v_shipping,
    'totalIdr', v_total,
    'courier', v_courier,
    'courierLabel', v_courier_record.label,
    'courierService', v_courier_record.service,
    'reservationExpiresAt', v_expires_at,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.create_order(uuid, jsonb, text, text, jsonb, text, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, text, text, jsonb, text, text) to authenticated;

grant execute on function public.sorelle_shipping_zone(text), public.sorelle_shipping_cost_idr(bigint, text) to anon, authenticated;
