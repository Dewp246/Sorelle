# Sorelle — Marketplace Artisan

Ruang belanja kurasi untuk produk rumah, gaya hidup, dan artisan lokal. Aplikasi web Next.js dengan autentikasi Supabase, pembayaran Midtrans Snap, dan pelacakan pengiriman Biteship.

## Fitur

- **Katalog produk** — dibaca langsung dari tabel `products` Supabase dengan kebijakan RLS publik (hanya produk dan toko berstatus `active`).
- **Autentikasi** — masuk, daftar, dan pemulihan kata sandi melalui Supabase Auth. Trigger database otomatis membuat baris `profiles` dan `loyalty_accounts` untuk pengguna baru.
- **Keranjang & checkout** — alamat pengiriman divalidasi, lalu pesanan dan itemnya dibuat di server.
- **Reservasi stok 15 menit** — fungsi database transaksional `create_order` mengunci dan mengurangi stok, serta mencatat reservasi. Reservasi kedaluwarsa dilepas otomatis oleh job `pg_cron` setiap menit.
- **Pembayaran Midtrans Snap** — token Snap dibuat di server; pop-up pembayaran muncul di checkout. Webhook memverifikasi signature SHA-512 sebelum menandai pesanan lunas.
- **Koin loyalitas** — hadiah +500 koin dicatat idempoten setelah pembayaran terverifikasi.
- **Pelacakan pengiriman** — pesanan lunas membuat pengiriman Biteship; halaman Tracking menampilkan linimasa `shipment_events`. Webhook Biteship memperbarui status hingga `delivered`.
- **Mode pratinjau** — tanpa variabel Supabase, UI memakai katalog demo dan menampilkan pemberitahuan.

## Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, ikon Lucide, CSS kustom |
| Basis data & Auth | Supabase (PostgreSQL + RLS) |
| Pembayaran | Midtrans Snap (Sandbox/Production) |
| Pengiriman | Biteship API |
| Hosting | Vercel (disarankan) |

## Struktur proyek

```text
src/
  app/
    api/
      biteship/webhook/       # Webhook checkpoint pengiriman Biteship
      midtrans/notification/  # Webhook pembayaran Midtrans
      orders/                 # Pembuatan pesanan (reservasi stok)
      payment/snap-token/     # Pembuatan token Snap
      tracking/               # Data pelacakan & simulasi checkpoint
    globals.css               # Token warna, tipografi, komponen
    layout.tsx                # Metadata & script Snap
    page.tsx                  # Seluruh layar aplikasi (SPA state)
  lib/
    biteship.ts               # Klien Biteship
    midtrans.ts               # Snap & verifikasi signature
    supabase.ts               # Klien publik + admin
  types/midtrans.d.ts         # Tipe window.snap
supabase/
  migrations/                 # Skema, RLS, fungsi, cron
  seed_demo.sql               # Katalog contoh (khusus pengujian)
  README.md                   # Panduan setup Supabase
```

## Menjalankan secara lokal

1. **Prasyarat:** Node.js 20 atau lebih baru, npm, dan akun Supabase.
2. Pasang dependensi:

   ```powershell
   npm install
   ```

3. Salin `.env.example` menjadi `.env.local`, lalu isi nilainya:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

   NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
   NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false

   BITESHIP_API_KEY=biteship_test.xxxx
   ```

   `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SERVER_KEY`, dan `BITESHIP_API_KEY` adalah rahasia server. Jangan pernah menaruhnya di variabel `NEXT_PUBLIC_*`, source code, atau repositori.

4. Siapkan database dengan menjalankan migrasi sesuai [supabase/README.md](./supabase/README.md), lalu isi katalog.
5. Jalankan aplikasi:

   ```powershell
   npm run dev
   ```

6. Perintah lain: `npm run build` untuk build produksi, `npm run lint` untuk ESLint.

## Alur transaksi

1. Pembeli memilih produk dan mengisi alamat.
2. `POST /api/orders` memvalidasi sesi dan input, lalu memanggil fungsi `create_order` untuk menghitung ulang harga, mengunci stok, dan membuat pesanan `pending_payment`.
3. Backend membuat token Snap dan menyimpan baris `payments` berstatus `pending`.
4. Pop-up Snap menyelesaikan pembayaran; `POST /api/midtrans/notification` memverifikasi signature dan memperbarui pesanan menjadi `paid`.
5. Setelah lunas, backend membuat pengiriman Biteship dan mencatat checkpoint awal. Webhook Biteship menambah checkpoint berikutnya.

Pesanan yang tidak dibayar dalam 15 menit dibatalkan otomatis dan stoknya dikembalikan.

## Batasan saat ini

- Riwayat pesanan di halaman Akun belum menampilkan data dari database.
- Ulasan produk, halaman pelacakan kurir real-time, dan upload media belum terhubung ke backend.
- Pemilihan kurir dan tarif ongkir masih berupa satu opsi reguler; tarif dihitung dengan aturan tetap, bukan dari API.
- Harga, stok, dan gambar pada `seed_demo.sql` hanya contoh; ganti dengan data merchant sebelum penjualan nyata.
- Peringatan ESLint untuk `<img>` belum ditangani (belum memakai `next/image`).

## Lisensi

Proyek privat. Hak cipta © 2026 Sorelle.
