# Supabase setup

This migration creates the first Sorelle marketplace schema, ownership-based RLS policies, and a signup trigger that creates a profile and an empty loyalty account. It deliberately contains no sample products or customer/order data.

## Apply in the Supabase Dashboard

1. Create a Supabase project and choose a region suitable for your users.
2. Open **SQL Editor → New query**.
3. Copy and run `migrations/20261026000000_initial_schema.sql` once.
4. Open **Table Editor** and check the tables: `profiles`, `stores`, `categories`, `products`, `orders`, `order_items`, `payments`, `shipment_events`, `order_proofs`, `reviews`, `review_media`, `loyalty_accounts`, and `loyalty_transactions`.
5. In **Authentication → Users**, create a test user. Verify matching rows appear in `profiles` and `loyalty_accounts`.
6. Confirm **RLS enabled** on every table. Do not expose the service-role/secret key in a browser, Git, or a `NEXT_PUBLIC_` environment variable.

## Configure and test Supabase Auth

1. In **Authentication → Providers → Email**, enable email/password sign-in.
2. In **Authentication → URL Configuration**, add the local callback URLs used during development, such as `http://localhost:3000/**` and `http://localhost:3001/**`. Add the production Vercel domain after deployment. Keep the production Site URL set to the production domain when going live.
3. Start the app with `npm run dev`, open its local URL, choose **Akun → Masuk / daftar**, and create a test account.
4. If email confirmation is enabled, open the confirmation email. The app sends the confirmation redirect to the current origin; that origin must be in the allowed redirect URL list.
5. Verify the user appears in **Authentication → Users** and that the signup trigger created rows in `profiles` and `loyalty_accounts`.
6. Test sign-out/sign-in and **Lupa kata sandi**. The reset redirect also returns to the current origin, so allow that URL.

The application has login, signup, password reset, and a basic signed-in account state. Other account fields/orders remain demo-only.

## Checkout migration and reservation

Before using the checkout endpoint, apply `migrations/20261026010000_checkout_reservations.sql` to the same Supabase project using SQL Editor. It adds the atomic `create_order` database function, an idempotency key, and stock reservations that expire after 15 minutes. The migration enables `pg_cron` to run the reservation-release job every minute. Confirm the migration runs successfully and verify **Database → Extensions → pg_cron** is enabled. If enabling `pg_cron` or scheduling is blocked in your project, stop here and configure an equivalent trusted scheduled job before accepting orders; do not manually mark orders paid or release stock from a browser.

The Next.js `POST /api/orders` endpoint requires a valid Supabase Auth bearer token. It calls the database function, which recalculates prices from active products, locks/decrements stock transactionally, writes pending orders, and returns an idempotent response. Only apply this migration to a project with the initial schema already installed.

Midtrans is not connected yet. Created orders remain `pending_payment`; the app explicitly does not report payment success. Do not launch live checkout until a verified Midtrans notification endpoint can mark payment and order status safely.

## Optional Supabase CLI flow

Install the Supabase CLI using its official instructions, then run from the repository root:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

The CLI path applies the migration tracked in `supabase/migrations`. Do not run both paths on the same database unless the migration has been recorded by the CLI; otherwise the SQL Editor run will not be reflected in the CLI migration history.

## What stays server-only

## Connect the product catalog

1. Copy `.env.example` to `.env.local` in the repository root.
2. In Supabase **Project Settings → API**, copy the Project URL and publishable/anon key into those two variables. Never use the service-role/secret key here.
3. Restart `npm run dev`. With both values configured, the home page and catalog load active products/categories from Supabase under the public RLS policies. With no values configured, the UI shows its demo catalog and a preview-mode notice.
4. If the catalog request fails, check browser console and confirm the store and products are `active`, category is active, and the product `store_id` and `category_id` match existing rows.

The current UI is still a demo for cart, checkout, accounts, and orders; only the product catalog reads Supabase. Build server-side order creation, pricing/stock validation, payment notifications, status transitions, and loyalty crediting before taking real orders. Use a server-only secret/service-role key only in trusted server code; never let a customer write orders, payment state, prices, stock, or loyalty points directly.

Create private Storage buckets and policies for review/proof media separately before enabling uploads. This migration stores file paths only, not file contents. Add real products and merchant records through an authenticated admin workflow after the schema is applied.

## Optional demo catalog

For testing only, open `seed_demo.sql` in the SQL Editor and run it after the schema migration. It inserts one demo store, five categories, and eight illustrative products. It is safe to run repeatedly by slug. Values, stock, descriptions, badges, and third-party image URLs are placeholders; do not use them as a live merchant catalog. Replace them with merchant-approved data or skip this seed in production.
