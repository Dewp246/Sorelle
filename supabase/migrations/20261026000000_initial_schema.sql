create extension if not exists pgcrypto;

create type public.order_status as enum (
  'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'
);
create type public.payment_status as enum (
  'pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'refund', 'partial_refund'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'paused', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  price_idr integer not null check (price_idr >= 0),
  compare_at_price_idr integer check (compare_at_price_idr >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_store_status_idx on public.products(store_id, status);
create index products_category_status_idx on public.products(category_id, status);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  status public.order_status not null default 'pending_payment',
  subtotal_idr integer not null check (subtotal_idr >= 0),
  shipping_idr integer not null default 0 check (shipping_idr >= 0),
  discount_idr integer not null default 0 check (discount_idr >= 0),
  total_idr integer not null check (total_idr >= 0),
  shipping_name text not null,
  shipping_phone text not null,
  shipping_address jsonb not null,
  courier text,
  tracking_number text,
  customer_note text,
  paid_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_idr = subtotal_idr + shipping_idr - discount_idr)
);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  product_name text not null,
  unit_price_idr integer not null check (unit_price_idr >= 0),
  quantity integer not null check (quantity > 0),
  line_total_idr integer not null check (line_total_idr = unit_price_idr * quantity),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null default 'midtrans' check (provider in ('midtrans')),
  provider_order_id text not null unique,
  provider_transaction_id text unique,
  status public.payment_status not null default 'pending',
  amount_idr integer not null check (amount_idr >= 0),
  payment_type text,
  fraud_status text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id);
create index payments_status_created_idx on public.payments(status, created_at desc);

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  description text not null,
  location text,
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index shipment_events_order_time_idx on public.shipment_events(order_id, event_at desc);

create table public.order_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null,
  proof_type text not null check (proof_type in ('delivery', 'unboxing', 'damage')),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(order_id, storage_path)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 3000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_product_status_idx on public.reviews(product_id, status, created_at desc);

create table public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  unique(review_id, storage_path)
);

create table public.loyalty_accounts (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  review_id uuid references public.reviews(id) on delete set null,
  points integer not null check (points <> 0),
  reason text not null check (reason in ('purchase', 'review', 'redemption', 'adjustment', 'expiration')),
  created_at timestamptz not null default now(),
  check ((reason = 'review' and review_id is not null) or reason <> 'review'),
  check ((reason in ('purchase', 'redemption') and order_id is not null) or reason not in ('purchase', 'redemption'))
);
create index loyalty_transactions_customer_idx on public.loyalty_transactions(customer_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.loyalty_accounts (customer_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger stores_set_updated_at before update on public.stores
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.order_proofs enable row level security;
alter table public.reviews enable row level security;
alter table public.review_media enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;

create policy "Customers can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Customers can update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Active stores are visible" on public.stores
  for select to anon, authenticated using (status = 'active');
create policy "Active categories are visible" on public.categories
  for select to anon, authenticated using (is_active);
create policy "Active products from active stores are visible" on public.products
  for select to anon, authenticated using (
    status = 'active' and exists (
      select 1 from public.stores s where s.id = store_id and s.status = 'active'
    )
  );

create policy "Customers can read their own orders" on public.orders
  for select to authenticated using ((select auth.uid()) = customer_id);
create policy "Customers can read items from their orders" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
  );
create policy "Customers can read payment status for their orders" on public.payments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
  );
create policy "Customers can read shipment updates for their orders" on public.shipment_events
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
  );
create policy "Customers can read proofs for their orders" on public.order_proofs
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
  );
create policy "Customers can add proof to their delivered orders" on public.order_proofs
  for insert to authenticated with check (
    (select auth.uid()) = uploaded_by and exists (
      select 1 from public.orders o where o.id = order_id
      and o.customer_id = (select auth.uid()) and o.status in ('delivered', 'completed')
    )
  );

create policy "Published reviews are visible" on public.reviews
  for select to anon, authenticated using (status = 'published');
create policy "Customers can review completed purchases" on public.reviews
  for insert to authenticated with check (
    (select auth.uid()) = customer_id and exists (
      select 1 from public.order_items i
      join public.orders o on o.id = i.order_id
      where i.id = order_item_id and i.product_id = reviews.product_id
      and o.customer_id = (select auth.uid()) and o.status = 'completed'
    )
  );
create policy "Customers can update their published reviews" on public.reviews
  for update to authenticated using (
    (select auth.uid()) = customer_id and status = 'published'
  ) with check (
    (select auth.uid()) = customer_id and status = 'published'
    and exists (
      select 1 from public.order_items i
      join public.orders o on o.id = i.order_id
      where i.id = order_item_id and i.product_id = reviews.product_id
      and o.customer_id = (select auth.uid()) and o.status = 'completed'
    )
  );
create policy "Customers can read media for published reviews" on public.review_media
  for select to anon, authenticated using (
    exists (select 1 from public.reviews r where r.id = review_id and r.status = 'published')
  );
create policy "Customers can add media to their reviews" on public.review_media
  for insert to authenticated with check (
    exists (select 1 from public.reviews r where r.id = review_id and r.customer_id = (select auth.uid()))
  );

create policy "Customers can read their loyalty balance" on public.loyalty_accounts
  for select to authenticated using ((select auth.uid()) = customer_id);
create policy "Customers can read their loyalty history" on public.loyalty_transactions
  for select to authenticated using ((select auth.uid()) = customer_id);

revoke all on all tables in schema public from anon, authenticated;
grant select on public.stores, public.categories, public.products, public.reviews, public.review_media to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.order_proofs to authenticated;
grant select on public.orders, public.order_items, public.payments, public.shipment_events,
  public.loyalty_accounts, public.loyalty_transactions to authenticated;
grant select, insert, update on public.reviews to authenticated;
grant select, insert on public.review_media to authenticated;

grant usage on schema public to anon, authenticated;
grant execute on function public.set_updated_at() to authenticated;
