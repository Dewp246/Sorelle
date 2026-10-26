-- DEMO ONLY: illustrative catalog values and third-party image URLs for local/preview testing.
-- Do not run in production; replace prices, stock, descriptions, and images with merchant-approved data.
begin;

insert into public.stores (name, slug, description, status)
values (
  'Sorelle Artisan Living',
  'sorelle-artisan-living',
  'Pilihan rumah dan gaya hidup dari artisan lokal. Data toko ini hanya untuk demo.',
  'active'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status;

insert into public.categories (name, slug, sort_order, is_active)
values
  ('Rumah & Dapur', 'rumah-dapur', 1, true),
  ('Fashion', 'fashion', 2, true),
  ('Kecantikan', 'kecantikan', 3, true),
  ('Bahan Makanan', 'bahan-makanan', 4, true),
  ('Gaya Hidup', 'gaya-hidup', 5, true)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.products (
  store_id, category_id, name, slug, description, price_idr,
  compare_at_price_idr, stock, image_url, status
)
select
  s.id,
  c.id,
  p.name,
  p.slug,
  p.description,
  p.price_idr,
  p.compare_at_price_idr,
  p.stock,
  p.image_url,
  'active'
from public.stores s
cross join (values
  ('teko-keramik-warm-earth', 'Teko Keramik Warm Earth Infuser 800ml', 'Handcrafted terracotta finish · Kasongan', 'rumah-dapur', 289000, 345000, 8, 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=85', 'Pilihan artisan'),
  ('set-cangkir-stoneware', 'Set 2 Cangkir Keramik Stoneware', 'Sepasang cangkir buatan tangan', 'rumah-dapur', 178000, null, 14, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85', null),
  ('minyak-atsiri-sandalwood-diffuser-jati', 'Minyak Atsiri Sandalwood & Diffuser Jati', 'Minyak cendana organik · 30ml', 'gaya-hidup', 385000, null, 12, 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=85', 'Bestseller'),
  ('nampan-kayu-jati-organik', 'Nampan Kayu Jati Solid Organik', 'Satu per satu dipahat pengrajin Jepara', 'rumah-dapur', 215000, null, 6, 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=900&q=85', null),
  ('kemeja-katun-linen-sorelle', 'Kemeja Katun Linen Sorelle', 'Linen lembut, nyaman dipakai seharian', 'fashion', 329000, null, 20, 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=85', 'Koleksi baru'),
  ('kopi-arabika-toraja', 'Kopi Arabika Toraja Single Origin', 'Sangrai artisan · 250 gram', 'bahan-makanan', 96000, null, 30, 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=85', null),
  ('diffuser-keramik-ultrasonic', 'Diffuser Keramik Ultrasonic Silent Fog', 'Kabut lembut untuk sudut tenangmu', 'kecantikan', 455000, null, 5, 'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=900&q=85', null),
  ('tas-anyaman-serat-alam', 'Tas Anyaman Serat Alam & Aksen Kulit', 'Dianyam tangan oleh artisan lokal', 'fashion', 420000, null, 9, 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85', null)
) as p(slug, name, description, category_slug, price_idr, compare_at_price_idr, stock, image_url, badge)
join public.categories c on c.slug = p.category_slug
where s.slug = 'sorelle-artisan-living'
on conflict (slug) do update set
  store_id = excluded.store_id,
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price_idr = excluded.price_idr,
  compare_at_price_idr = excluded.compare_at_price_idr,
  stock = excluded.stock,
  image_url = excluded.image_url,
  status = excluded.status,
  updated_at = now();

commit;
