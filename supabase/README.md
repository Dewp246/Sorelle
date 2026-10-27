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

## Custom SMTP (Google Workspace / Gmail)

Supabase's built-in email service allows only **2 messages per hour** and delivers only to addresses inside your organization. That limit is what produces `email rate limit exceeded`. Configure your own SMTP to lift it.

1. Prepare the Google side:
   - A Google Workspace account (`you@yourdomain.com`) is preferred. With a personal Gmail account, enabling 2-Step Verification and creating an **App Password** is required, because Google rejects your normal password for SMTP.
   - Google Workspace admin: **Security → Access and data control → Less secure apps** should stay off; use App Passwords instead.
2. Create the credential:
   - Google Account → **Security** → **2-Step Verification** → **App passwords**.
   - Name it `Supabase Sorelle`, then copy the 16-character password.
3. In Supabase open **Authentication → Emails → SMTP Settings** and enable custom SMTP:

   | Field | Value |
   | --- | --- |
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | your full Gmail/Workspace address |
   | Password | the 16-character App Password (no spaces) |
   | Sender email | your Gmail/Workspace address |
   | Sender name | `Sorelle` |

4. Save, then send a test email from the same page. To confirm signup, register with a different address.
5. After enabling custom SMTP, raise the limits in **Authentication → Rate Limits** if needed (default becomes 30 messages/hour).

Notes and limits:

- Gmail sending limits are roughly 500 recipients/day for Workspace and ~100/day for a free Gmail account. This is fine for testing and early production but not for high-volume transactional mail; services such as Resend, Brevo, or SendGrid scale better.
- Never commit the App Password. It is only entered in the Supabase dashboard.
- Keep the **Email** provider and confirmation templates enabled after switching, otherwise signups stop working.

## Checkout migration and reservation

Before using the checkout endpoint, apply `migrations/20261026010000_checkout_reservations.sql` to the same Supabase project using SQL Editor. It adds the atomic `create_order` database function, an idempotency key, and stock reservations that expire after 15 minutes. The migration enables `pg_cron` to run the reservation-release job every minute. Confirm the migration runs successfully and verify **Database → Extensions → pg_cron** is enabled. If enabling `pg_cron` or scheduling is blocked in your project, stop here and configure an equivalent trusted scheduled job before accepting orders; do not manually mark orders paid or release stock from a browser.

The Next.js `POST /api/orders` endpoint requires a valid Supabase Auth bearer token. It calls the database function, which recalculates prices from active products, locks/decrements stock transactionally, writes pending orders, and returns an idempotent response. Only apply this migration to a project with the initial schema already installed.

Midtrans is not connected yet. Created orders remain `pending_payment`; the app explicitly does not report payment success. Do not launch live checkout until a verified Midtrans notification endpoint can mark payment and order status safely.

## Zone-based shipping estimate

Biteship's tracking API is used after payment, but its **rates API requires a paid balance**. As a free alternative, `20261027000000_zone_shipping.sql` adds an offline estimate:

- Zone 1 (Jawa & Bali): Rp 18.000
- Zone 2 (Sumatera, Kalimantan, Sulawesi, NTB): Rp 32.000
- Zone 3 (Maluku & Papua): Rp 45.000
- Free shipping at a subtotal of Rp 500.000 or more.

Couriers multiply that base (AnterAja 0.95, SiCepat 1.00, J&T 1.05, JNE 1.10, and Grab Same Day 1.60 for zone 1 only). Apply this migration after the checkout reservations migration. `create_order` keeps the same contract with one added argument, `p_courier`. The database is the authority; `src/lib/shipping.ts` only drives the checkout preview, so keep both zone lists in sync if you change them.

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
