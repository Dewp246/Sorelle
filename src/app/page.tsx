"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown,
  ChevronRight, Clock3, CreditCard, Headphones, Heart, House, Leaf,
  MapPin, Menu, Minus, PackageCheck, Plus, Search, ShieldCheck, ShoppingBag,
  SlidersHorizontal, Sparkles, Star, Truck, UserRound, X,
} from 'lucide-react';

type View = 'home' | 'catalog' | 'product' | 'cart' | 'checkout' | 'complete' | 'review' | 'tracking' | 'account' | 'login';
type Product = { id: string; name: string; description: string; price: number; oldPrice?: number; category: string; image: string; stock: number };
const demoProducts: Product[] = [
  { id: 'demo-1', name: 'Teko Keramik Warm Earth Infuser 800ml', description: 'Handcrafted terracotta finish · Kasongan', price: 289000, oldPrice: 345000, category: 'Rumah & Dapur', image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=85', stock: 8 },
  { id: 'demo-2', name: 'Set 2 Cangkir Keramik Stoneware', description: 'Sepasang cangkir buatan tangan', price: 178000, category: 'Rumah & Dapur', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85', stock: 14 },
  { id: 'demo-3', name: 'Minyak Atsiri Sandalwood & Diffuser Jati', description: 'Minyak cendana organik · 30ml', price: 385000, category: 'Gaya Hidup', image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=85', stock: 12 },
  { id: 'demo-4', name: 'Nampan Kayu Jati Solid Organik', description: 'Satu per satu dipahat pengrajin Jepara', price: 215000, category: 'Rumah & Dapur', image: 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=900&q=85', stock: 6 },
  { id: 'demo-5', name: 'Kemeja Katun Linen Sorelle', description: 'Linen lembut, nyaman dipakai seharian', price: 329000, category: 'Fashion', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=85', stock: 20 },
  { id: 'demo-6', name: 'Kopi Arabika Toraja Single Origin', description: 'Sangrai artisan · 250 gram', price: 96000, category: 'Bahan Makanan', image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=85', stock: 30 },
  { id: 'demo-7', name: 'Diffuser Keramik Ultrasonic Silent Fog', description: 'Kabut lembut untuk sudut tenangmu', price: 455000, category: 'Kecantikan', image: 'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=900&q=85', stock: 5 },
  { id: 'demo-8', name: 'Tas Anyaman Serat Alam & Aksen Kulit', description: 'Dianyam tangan oleh artisan lokal', price: 420000, category: 'Fashion', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85', stock: 9 },
];
const demoCategories = ['Semua', 'Rumah & Dapur', 'Fashion', 'Kecantikan', 'Bahan Makanan', 'Gaya Hidup'];
const money = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const views: Record<string, View> = { Beranda: 'home', Kategori: 'catalog', Favorit: 'catalog', Pesanan: 'tracking', Akun: 'account' };

export default function Sorelle() {
  const [view, setView] = useState<View>('home');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<Product[]>(supabase ? [] : demoProducts);
  const [categories, setCategories] = useState(demoCategories);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(Boolean(supabase));
  const [selected, setSelected] = useState<Product>(demoProducts[0]);
  const [category, setCategory] = useState('Semua');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Pilihan untuk Anda');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [notice, setNotice] = useState('');
  const [like, setLike] = useState<string[]>([]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [stage, setStage] = useState<'address' | 'shipping' | 'payment' | 'done'>('address');
  const [authUser, setAuthUser] = useState<{ id: string; email?: string; user_metadata?: Record<string, unknown> } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset' | 'update'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [orderRequestKey, setOrderRequestKey] = useState('');
  const [shippingDetails, setShippingDetails] = useState({ name: '', phone: '', street: '', city: '', province: '', postalCode: '', note: '' });
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    orderNumber: string;
    status: string;
    subtotalIdr: number;
    shippingIdr: number;
    totalIdr: number;
    reservationExpiresAt: string;
    snapToken?: string | null;
    snapRedirectUrl?: string | null;
  } | null>(null);

  const [trackingOrder, setTrackingOrder] = useState<{
    id: string;
    order_number: string;
    status: string;
    courier?: string | null;
    tracking_number?: string | null;
    shipping_name: string;
    shipping_phone: string;
    shipping_address: Record<string, unknown>;
    created_at: string;
    delivered_at?: string | null;
  } | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<Array<{
    id: string;
    status: string;
    description: string;
    location?: string | null;
    event_at: string;
  }>>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingSimulating, setTrackingSimulating] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') { setAuthMode('update'); setView('login'); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (view === 'tracking' && authUser) {
      void loadTrackingData();
    }
  }, [view, authUser]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    async function loadCatalog() {
      if (!client) return;
      const [productResult, categoryResult] = await Promise.all([
        client.from('products').select('id,name,description,price_idr,compare_at_price_idr,stock,image_url,categories(name)').eq('status', 'active').order('created_at', { ascending: false }),
        client.from('categories').select('name').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);
      if (cancelled) return;
      if (productResult.error || categoryResult.error) {
        setCatalogError(productResult.error?.message ?? categoryResult.error?.message ?? 'Gagal memuat katalog.');
        setCatalogLoading(false);
        return;
      }
      const loadedProducts: Product[] = (productResult.data ?? []).map((row) => {
        const categoryRelation = row.categories as { name: string } | { name: string }[] | null;
        const categoryName = Array.isArray(categoryRelation) ? categoryRelation[0]?.name : categoryRelation?.name;
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          price: row.price_idr,
          oldPrice: row.compare_at_price_idr ?? undefined,
          category: categoryName ?? 'Lainnya',
          image: row.image_url ?? '',
          stock: row.stock,
        };
      });
      setProducts(loadedProducts);
      setCategories(['Semua', ...new Set((categoryResult.data ?? []).map((item) => item.name))]);
      if (loadedProducts[0]) setSelected(loadedProducts[0]);
      setCatalogLoading(false);
    }
    loadCatalog().catch((error: unknown) => {
      if (!cancelled) {
        setCatalogError(error instanceof Error ? error.message : 'Gagal memuat katalog.');
        setCatalogLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);
  const cartItems = products.filter((p) => cart[p.id]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = cartItems.reduce((s, p) => s + p.price * cart[p.id], 0);
  const shipping = subtotal >= 500000 ? 0 : 18000;
  const total = subtotal + shipping;
  const visibleProducts = useMemo(() => {
    let result = products.filter((p) => (category === 'Semua' || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === 'Harga terendah') result = [...result].sort((a, b) => a.price - b.price);
    if (sort === 'Harga tertinggi') result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [category, products, query, sort]);
  const go = (v: View) => { setView(v); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const add = (id: string, amount = 1) => { setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + amount) })); setNotice(amount > 0 ? 'Ditambahkan ke keranjang' : 'Jumlah diperbarui'); window.setTimeout(() => setNotice(''), 2300); };
  const photo = (p: Product, variant: 'cover' | 'contain' = 'cover', className = '') => p.image ? <img src={p.image} alt={p.name} className={`${className} product-image ${variant}`} loading="lazy" /> : <span className="product-image-placeholder" role="img" aria-label={`Belum ada foto untuk ${p.name}`}><PackageCheck/></span>;
  const goProduct = (p: Product) => { setSelected(p); go('product'); };
  function Header() {
    return <><div className="announcement">Dikirim dengan kasih · Gratis ongkir untuk belanja min. Rp 500.000</div><header className="site-header"><button className="icon-button menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Buka menu">{mobileMenu ? <X/> : <Menu/>}</button><button className="brand" onClick={() => go('home')} aria-label="Sorelle beranda">sorelle<span>.</span><small>ruang untuk yang berarti</small></button><nav className="desktop-nav" aria-label="Navigasi utama">{['Beranda','Jelajahi','Rumah & Dapur','Cerita Artisan'].map((item) => <button key={item} onClick={() => { setCategory(item === 'Rumah & Dapur' ? item : 'Semua'); go(item === 'Beranda' ? 'home' : 'catalog'); }}>{item}</button>)}</nav><label className="header-search"><Search size={18}/><input aria-label="Cari produk" placeholder="Cari sesuatu yang berarti..." value={query} onChange={(e) => { setQuery(e.target.value); if(e.target.value) setView('catalog'); }}/><kbd>⌘ K</kbd></label><div className="header-actions"><button className="icon-button favorite-desktop" aria-label="Favorit" onClick={() => go('catalog')}><Heart/></button><button className="icon-button account-desktop" aria-label="Akun" onClick={() => go(authUser ? 'account' : 'login')}><UserRound/></button><button className="bag-button" aria-label={`Keranjang, ${count} barang`} onClick={() => go('cart')}><ShoppingBag/><span className="bag-label">Tas</span><b>{count}</b></button></div></header>{mobileMenu && <nav className="mobile-menu">{['Beranda','Kategori','Pesanan','Akun'].map((x)=><button key={x} onClick={()=>go(views[x])}>{x}<ChevronRight size={16}/></button>)}</nav>}</>;
  }
  function Footer() {
    return <footer className="footer"><div className="footer-main"><div className="footer-brand"><button className="brand" onClick={() => go('home')}>sorelle<span>.</span></button><p>Ruang belanja kurasi yang hangat untuk rumah, gaya hidup, dan para artisan lokal.</p><div className="social-links"><span>Instagram</span><span>Pinterest</span><span>TikTok</span></div></div><div><h4>Bantuan</h4><button onClick={()=>go('tracking')}>Cara melacak pesanan</button><button onClick={()=>setNotice('Pusat bantuan akan segera tersedia.')}>Kebijakan pengembalian</button><button onClick={()=>setNotice('Pusat bantuan akan segera tersedia.')}>Pusat bantuan</button></div><div><h4>Jelajahi</h4><button onClick={()=>go('catalog')}>Semua produk</button><button onClick={()=>go('catalog')}>Cerita pengrajin</button><button onClick={()=>go('catalog')}>Tentang Sorelle</button></div><div className="newsletter"><h4>Surat kecil dari Sorelle</h4><p>Catatan pilihan, cerita artisan, dan hal-hal yang membuat rumah terasa pulang.</p><form onSubmit={(e)=>{e.preventDefault();setNotice('Terima kasih. Anda masuk daftar surat Sorelle.');}}><input type="email" aria-label="Alamat email" placeholder="Alamat email kamu" required/><button aria-label="Daftar newsletter"><ArrowRight size={18}/></button></form></div></div><div className="footer-bottom"><span>© 2026 Sorelle Marketplace</span><span>Privasi &nbsp; · &nbsp; Syarat &nbsp; · &nbsp; Pembayaran aman</span><span>Dirangkai dengan hati, di Indonesia</span></div></footer>;
  }
  function ProductCard({ product: p, index = 0 }: { product: Product; index?: number }) {
    return <article className="product-card" style={{ animationDelay: `${index * 60}ms` }}><div className="product-photo" onClick={() => goProduct(p)} role="button" tabIndex={0} onKeyDown={(e)=>{if(e.key==='Enter')goProduct(p)}}>{photo(p)}<button className={`heart-button ${like.includes(p.id)?'liked':''}`} aria-label="Simpan ke favorit" aria-pressed={like.includes(p.id)} onClick={(e)=>{e.stopPropagation();setLike((v)=>v.includes(p.id)?v.filter(x=>x!==p.id):[...v,p.id]);}}><Heart size={19} fill={like.includes(p.id)?'currentColor':'none'}/></button><button className="quick-add" onClick={(e)=>{e.stopPropagation();add(p.id);}} aria-label="Tambah ke keranjang"><Plus size={17}/></button></div><div className="product-copy"><div className="product-meta"><span>{p.category}</span></div><button className="product-name" onClick={()=>goProduct(p)}>{p.name}</button><div className="product-price">{money(p.price)}{p.oldPrice && <del>{money(p.oldPrice)}</del>}</div><div className="artisan-credit"><span className="artisan-avatar">S</span> Dibuat penuh perhatian</div></div></article>;
  }
  function ProductGrid({ items = products }: { items?: Product[] }) { return <div className="product-grid">{items.map((p,i)=><ProductCard product={p} index={i} key={p.id}/>)}</div>; }
  function Home() {
    return <><main><section className="home-hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={14}/> pilihan baik, dibuat perlahan</span><h1>Kenyamanan rumah,<br/><em>dirangkai dengan hati.</em></h1><p>Temukan kerajinan artisan, benda sehari-hari, dan cerita kecil yang menjadikan rumah terasa pulang.</p><div className="hero-actions"><button className="button primary" onClick={()=>go('catalog')}>Jelajahi koleksi <ArrowRight size={17}/></button><button className="text-link" onClick={()=>go('catalog')}>Kenali para artisan <ArrowUpRight size={16}/></button></div><div className="hero-note"><span className="note-line"/>Benda baik. Cerita yang lebih baik.</div></div><div className="hero-art"><div className="hero-image-main"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=90" alt="Ruang keluarga hangat dengan benda-benda artisan"/></div><div className="hero-image-small"><img src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=500&q=80" alt="Detail cangkir keramik buatan tangan"/></div><div className="hero-caption"><span>01 / 04</span><i/> pilihan artisan, musim ini</div><span className="hero-stamp">BAIK<br/>BUATAN<br/>TANGAN</span></div><div className="hero-bottom"><span>01 — 04</span><span>Gulir perlahan <ArrowDown size={14}/></span><span>Bandung · Indonesia</span></div></section><section className="trust-strip"><div><PackageCheck/><span>Dipilih dengan saksama</span></div><div><Leaf/><span>Dibuat oleh tangan lokal</span></div><div><ShieldCheck/><span>Belanja aman dan tenang</span></div><div><Truck/><span>Diantar ke depan pintu</span></div></section><section className="section category-section"><div className="section-heading"><div><span className="eyebrow">Temukan yang kamu cari</span><h2>Sudut-sudut kecil,<br/><em>kemungkinan besar.</em></h2></div><button className="text-link" onClick={()=>go('catalog')}>Semua kategori <ArrowRight size={16}/></button></div><div className="category-grid">{[{name:'Rumah & Dapur',image:'photo-1600210492486-724fe5c67fb0',count:'Benda yang menghangatkan rumah'},{name:'Fashion',image:'photo-1483985988355-763728e1935b',count:'Karya yang ikut ke mana saja'},{name:'Gaya Hidup',image:'photo-1608571423902-eed4a5ad8108',count:'Ritual kecil untuk diri sendiri'}].map((c,i)=><button className={`category-card category-${i+1}`} key={c.name} onClick={()=>{setCategory(c.name);go('catalog')}}><img src={`https://images.unsplash.com/${c.image}?auto=format&fit=crop&w=800&q=80`} alt=""/><span className="category-index">0{i+1}</span><div className="category-caption"><div><h3>{c.name}</h3><p>{c.count}</p></div><span className="round-arrow"><ArrowUpRight size={19}/></span></div></button>)}</div></section><section className="section featured-section"><div className="section-heading"><div><span className="eyebrow">Baik adanya, baik gunanya</span><h2>Pilihan minggu ini</h2><p>Potongan kecil kebaikan yang siap menemukan rumahnya.</p></div><button className="text-link" onClick={()=>go('catalog')}>Lihat semua <ArrowRight size={16}/></button></div><ProductGrid items={products.slice(0,4)}/></section><section className="artisan-story"><div className="artisan-image"><img src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1100&q=85" alt="Pengrajin sedang membentuk keramik"/></div><div className="artisan-text"><span className="eyebrow">Dibuat bukan sekadar dibuat</span><h2>Di balik benda yang baik, ada <em>tangan yang bercerita.</em></h2><p>Setiap keramik, rajutan, dan anyaman punya waktu, ketekunan, serta kehidupan seorang artisan di baliknya. Kami merayakan semua itu, satu pilihan pada satu waktu.</p><button className="button outline" onClick={()=>go('catalog')}>Kenali para pengrajin <ArrowRight size={16}/></button><span className="story-index">cerita no. 01 — Kasongan</span></div></section><section className="newsletter-band"><div className="newsletter-icon"><Leaf/></div><div><span className="eyebrow">Ruang kecil di kotak masukmu</span><h2>Hal baik, <em>sesekali saja.</em></h2><p>Surat dari Sorelle: pilihan hangat, cerita artisan, dan inspirasi rumah.</p></div><form onSubmit={(e)=>{e.preventDefault();setNotice('Terima kasih. Anda masuk daftar surat Sorelle.');}}><input type="email" placeholder="Alamat email kamu" aria-label="Alamat email" required/><button aria-label="Daftar"><ArrowRight/></button></form></section></main></>;
  }
  function Catalog() {
    return <main className="catalog-page"><div className="breadcrumbs"><button onClick={()=>go('home')}>Beranda</button><ChevronRight size={14}/><span>Jelajahi</span></div><section className="catalog-heading"><div><span className="eyebrow">Pilihan untuk kehidupan sehari-hari</span><h1>Benda baik untuk <em>hidup yang penuh.</em></h1><p>Setiap pilihan punya cerita. Temukan yang paling terasa seperti milikmu.</p></div><div className="catalog-count">{visibleProducts.length}<span>pilihan untukmu</span></div></section><div className="catalog-toolbar"><div className="category-pills">{categories.map((c)=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><label className="sort-select"><SlidersHorizontal size={15}/><select value={sort} onChange={(e)=>setSort(e.target.value)} aria-label="Urutkan produk"><option>Pilihan untuk Anda</option><option>Harga terendah</option><option>Harga tertinggi</option></select></label></div>{visibleProducts.length ? <ProductGrid items={visibleProducts}/> : <div className="empty-state"><Search/><h2>Belum ada yang cocok</h2><p>Coba kata lain atau pilih kategori berbeda.</p><button className="button outline" onClick={()=>{setQuery('');setCategory('Semua');}}>Lihat semua produk</button></div>}<section className="artisan-strip"><div><Sparkles/><span>Setiap pilihan mendukung tangan-tangan lokal</span></div><span>Dibuat perlahan, dipilih sepenuh hati.</span></section></main>;
  }
  function ProductDetail() {
    if (!products.some((product) => product.id === selected.id)) return <main className="product-page"><div className="empty-state"><PackageCheck/><h2>Produk tidak tersedia</h2><p>Pilih produk yang aktif di katalog.</p><button className="button outline" onClick={()=>go('catalog')}>Kembali ke katalog</button></div></main>;
    const detailImages = products.filter((product) => product.id !== selected.id).slice(0, 3);
    return <main className="product-page"><div className="breadcrumbs"><button onClick={()=>go('home')}>Beranda</button><ChevronRight size={14}/><button onClick={()=>go('catalog')}>Rumah & Dapur</button><ChevronRight size={14}/><span>{selected.name}</span></div><div className="product-detail"><div className="detail-gallery"><div className="detail-main">{photo(selected)}<span className="product-badge">Dibuat pengrajin</span></div><div className="detail-thumbs"><button className="active">{photo(selected)}</button>{detailImages.map((product)=><button key={product.id} onClick={()=>setSelected(product)}>{photo(product)}</button>)}</div></div><div className="detail-copy"><span className="eyebrow">{selected.category}</span><h1>{selected.name}</h1><div className="detail-price">{money(selected.price)}{selected.oldPrice && <del>{money(selected.oldPrice)}</del>}</div><p className="tax-note">Sudah termasuk pajak · Biaya kirim dihitung saat checkout</p><div className="detail-divider"/><p className="detail-description">{selected.description}. Dikerjakan dengan sabar oleh artisan lokal, menggunakan material yang dipilih untuk menemani keseharianmu lebih lama.</p><div className="detail-benefits"><div><Check/> Pilihan material penuh perhatian</div><div><Check/> Dibungkus aman dan ramah lingkungan</div><div><Check/> Dukungan artisan lokal Indonesia</div></div><div className="stock-note"><span/> Tersedia · {selected.stock} buah tersisa</div><button className="button primary add-to-bag" onClick={()=>add(selected.id)}>Tambahkan ke keranjang <ShoppingBag size={17}/></button><button className="detail-wish" onClick={()=>setLike((v)=>v.includes(selected.id)?v.filter(x=>x!==selected.id):[...v,selected.id])}><Heart size={17} fill={like.includes(selected.id)?'currentColor':'none'}/> Simpan ke daftar keinginan</button><div className="detail-service"><div><Truck/><span><b>Pengiriman aman</b>Dikirim dari Bandung, 2–4 hari</span></div><div><ShieldCheck/><span><b>Belanja nyaman</b>Transaksi terlindungi</span></div></div></div></div><section className="section detail-more"><div className="section-heading"><div><span className="eyebrow">Boleh jadi kamu suka</span><h2>Temukan pasangannya.</h2></div><button className="text-link" onClick={()=>go('catalog')}>Lihat semua <ArrowRight size={16}/></button></div><ProductGrid items={products.filter((p)=>p.id!==selected.id).slice(0,4)}/></section></main>;
  }
  function Cart() {
    return <main className="cart-page"><div className="breadcrumbs"><button onClick={()=>go('home')}>Beranda</button><ChevronRight size={14}/><span>Keranjang Belanja</span></div><div className="page-heading"><div><span className="eyebrow">Sudah dekat jadi milikmu</span><h1>Keranjang <em>pilihanmu.</em></h1><p>{count} benda baik, siap menemukan rumahnya.</p></div><button className="text-link" onClick={()=>go('catalog')}><ArrowLeft size={16}/> Lanjut belanja</button></div>{!count ? <div className="empty-state cart-empty"><ShoppingBag/><h2>Keranjangmu sedang beristirahat</h2><p>Temukan sesuatu yang terasa seperti milikmu.</p><button className="button primary" onClick={()=>go('catalog')}>Jelajahi koleksi <ArrowRight size={16}/></button></div> : <div className="cart-layout"><div className="cart-list"><div className="cart-table-head"><span>Produk pilihan</span><span>Jumlah</span><span>Harga</span></div>{cartItems.map((p)=><article className="cart-item" key={p.id}><button className="cart-item-photo" onClick={()=>goProduct(p)}>{photo(p)}</button><div className="cart-item-info"><span className="eyebrow">{p.category}</span><button className="cart-item-name" onClick={()=>goProduct(p)}>{p.name}</button><p>{p.description}</p><button className="remove-item" onClick={()=>setCart((v)=>({...v,[p.id]:0}))}>Hapus pilihan</button></div><div className="quantity-control"><button onClick={()=>add(p.id,-1)} aria-label="Kurangi jumlah"><Minus size={14}/></button><span>{cart[p.id]}</span><button onClick={()=>add(p.id)} aria-label="Tambah jumlah"><Plus size={14}/></button></div><div className="cart-line-price">{money(p.price*cart[p.id])}</div></article>)}<div className="cart-delivery"><Truck/><div><b>{subtotal>=500000?'Selamat, ongkir ditanggung Sorelle.':'Sedikit lagi menuju ongkir gratis.'}</b><span>{subtotal>=500000?'Pilihanmu diantar tanpa biaya kirim.':`Tambah ${money(500000-subtotal)} untuk gratis ongkir.`}</span></div><div className="delivery-progress"><i style={{width:`${Math.min(100,subtotal/5000)}%`}}/></div></div></div><aside className="summary-card"><span className="eyebrow">Ruang ringkasan</span><h2>Ringkasan belanja</h2><div className="summary-line"><span>Subtotal · {count} benda</span><span>{money(subtotal)}</span></div><div className="summary-line"><span>Pengiriman</span><span>{shipping?money(shipping):'Ditanggung Sorelle'}</span></div><div className="summary-line"><span>Diskon pilihan</span><span>—</span></div><div className="summary-divider"/><div className="summary-line total"><b>Total sementara</b><b>{money(total)}</b></div><p className="summary-tax">Termasuk pajak yang berlaku.</p><button className="button primary checkout-button" onClick={()=>{setStage('address');go('checkout');}}>Lanjut ke checkout <ArrowRight size={17}/></button><div className="secure-note"><ShieldCheck size={16}/> Pembayaran aman & terlindungi</div><button className="coupon-toggle" onClick={()=>setNotice('Kode promo akan tersedia setelah checkout terhubung.')}>Punya kode promo? <ChevronDown size={15}/></button></aside></div>}</main>;
  }
  async function placeOrder() {
    if (!supabase || !authUser) { setNotice('Masuk ke akun sebelum membuat pesanan.'); go('login'); return; }
    if (!cartItems.length) { setNotice('Keranjang masih kosong.'); go('cart'); return; }
    setCheckoutBusy(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Sesi berakhir. Masuk kembali sebelum checkout.');
      const key = orderRequestKey || crypto.randomUUID();
      setOrderRequestKey(key);
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          idempotencyKey: key,
          items: cartItems.map((product) => ({ productId: product.id, quantity: cart[product.id] })),
          shippingName: shippingDetails.name,
          shippingPhone: shippingDetails.phone,
          shippingAddress: { street: shippingDetails.street, city: shippingDetails.city, province: shippingDetails.province, postalCode: shippingDetails.postalCode },
          customerNote: shippingDetails.note,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Pesanan belum dapat dibuat.');
      setCreatedOrder(result);
      setOrderRequestKey('');
      setCart({});
      go('complete');
      if (result.snapToken) {
        setTimeout(() => {
          triggerSnapPayment(result.snapToken);
        }, 500);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Pesanan gagal dibuat. Silakan coba lagi.');
    } finally {
      setCheckoutBusy(false);
    }
  }

  function triggerSnapPayment(token: string) {
    if (typeof window !== 'undefined' && window.snap) {
      window.snap.pay(token, {
        onSuccess: () => {
          setCreatedOrder((curr) => curr ? { ...curr, status: 'paid' } : null);
          setNotice('Pembayaran berhasil! Terima kasih.');
        },
        onPending: () => {
          setNotice('Menunggu penyelesaian pembayaran.');
        },
        onError: () => {
          setNotice('Pembayaran gagal atau dibatalkan.');
        },
        onClose: () => {
          setNotice('Sesi pembayaran ditutup. Anda dapat membayar kembali sebelum batas waktu.');
        },
      });
    } else if (createdOrder?.snapRedirectUrl) {
      window.open(createdOrder.snapRedirectUrl, '_blank');
    } else {
      setNotice('Midtrans Snap SDK sedang dimuat. Coba beberapa saat lagi.');
    }
  }

  async function requestPaymentToken(orderNumber: string) {
    try {
      const { data: { session } } = await supabase?.auth.getSession() ?? { data: {} };
      if (!session?.access_token) throw new Error('Sesi berakhir. Silakan masuk kembali.');
      const res = await fetch('/api/payment/snap-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orderNumber }),
      });
      const json = await res.json();
      if (!res.ok || !json.snapToken) throw new Error(json.error ?? 'Gagal membuat sesi pembayaran.');
      setCreatedOrder((curr) => curr ? { ...curr, snapToken: json.snapToken, snapRedirectUrl: json.snapRedirectUrl } : null);
      triggerSnapPayment(json.snapToken);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal membuka pembayaran.');
    }
  }

  async function checkOrderStatus() {
    if (!createdOrder || !supabase) return;
    try {
      const { data } = await supabase
        .from('orders')
        .select('status')
        .eq('id', createdOrder.orderId)
        .maybeSingle();

      if (data?.status) {
        setCreatedOrder((curr) => curr ? { ...curr, status: data.status } : null);
        if (data.status === 'paid') {
          setNotice('Pembayaran terkonfirmasi lunas!');
        } else if (data.status === 'cancelled') {
          setNotice('Pesanan telah dibatalkan atau kedaluwarsa.');
        } else {
          setNotice('Pesanan masih menunggu pembayaran.');
        }
      }
    } catch {
      setNotice('Gagal memeriksa status pesanan.');
    }
  }

  function Checkout() {
    const steps: { key: typeof stage; label: string }[] = [{key:'address',label:'Alamat'}, {key:'shipping',label:'Pengiriman'}, {key:'payment',label:'Pembayaran'}];
    const next = () => {
      if (stage === 'address') {
        if (![shippingDetails.name, shippingDetails.phone, shippingDetails.street, shippingDetails.city, shippingDetails.province, shippingDetails.postalCode].every((value) => value.trim())) {
          setNotice('Lengkapi nama, telepon, jalan, kota, provinsi, dan kode pos.'); return;
        }
        setStage('shipping');
      } else if (stage === 'shipping') setStage('payment');
      else void placeOrder();
    };
    return <main className="checkout-page"><div className="breadcrumbs"><button onClick={()=>go('home')}>Beranda</button><ChevronRight size={14}/><button onClick={()=>go('cart')}>Keranjang</button><ChevronRight size={14}/><span>Checkout</span></div><div className="page-heading"><div><span className="eyebrow">Satu langkah menuju rumah baru</span><h1>Checkout <em>yang tenang.</em></h1><p>Periksa detail, lalu kami siapkan pilihanmu.</p></div></div><div className="checkout-layout"><div className="checkout-main"><div className="checkout-steps">{steps.map((s,i)=><button key={s.key} className={`checkout-step ${stage===s.key?'active':''} ${steps.findIndex((x)=>x.key===stage)>i?'done':''}`} onClick={()=>setStage(s.key)}><span>{steps.findIndex((x)=>x.key===stage)>i?<Check size={15}/>:`0${i+1}`}</span>{s.label}</button>)}</div>{stage==='address' && <section className="checkout-section"><div className="checkout-title"><div><span className="eyebrow">Ke mana pilihanmu pergi?</span><h2>Alamat pengiriman</h2></div><button className="text-link" onClick={()=>setNotice('Formulir alamat baru segera tersedia.')}>+ Tambah alamat</button></div><label className="form-label">Nama penerima<input autoComplete="name" value={shippingDetails.name} onChange={(e)=>setShippingDetails({...shippingDetails,name:e.target.value})} required maxLength={120}/></label><label className="form-label">Nomor telepon<input type="tel" autoComplete="tel" value={shippingDetails.phone} onChange={(e)=>setShippingDetails({...shippingDetails,phone:e.target.value})} required maxLength={30}/></label><label className="form-label">Alamat jalan<input autoComplete="street-address" value={shippingDetails.street} onChange={(e)=>setShippingDetails({...shippingDetails,street:e.target.value})} required maxLength={250}/></label><div className="address-fields"><label className="form-label">Kota<input autoComplete="address-level2" value={shippingDetails.city} onChange={(e)=>setShippingDetails({...shippingDetails,city:e.target.value})} required maxLength={120}/></label><label className="form-label">Provinsi<input autoComplete="address-level1" value={shippingDetails.province} onChange={(e)=>setShippingDetails({...shippingDetails,province:e.target.value})} required maxLength={120}/></label></div><label className="form-label">Kode pos<input autoComplete="postal-code" value={shippingDetails.postalCode} onChange={(e)=>setShippingDetails({...shippingDetails,postalCode:e.target.value})} required maxLength={20}/></label><label className="form-label">Catatan kurir <span>opsional</span><textarea placeholder="Petunjuk pengantaran" rows={3} maxLength={1000} value={shippingDetails.note} onChange={(e)=>setShippingDetails({...shippingDetails,note:e.target.value})}/></label></section>}{stage==='shipping' && <section className="checkout-section"><div className="checkout-title"><div><span className="eyebrow">Dipilih sesuai kebutuhan</span><h2>Opsi pengiriman</h2></div></div><div className="shipping-option selected"><span className="radio-mark"/><Truck/><span><b>Pengiriman reguler</b><small>Ongkir dihitung server. Estimasi belum terhubung ke kurir.</small></span><strong>{shipping?money(shipping):'Gratis'}</strong></div><p className="form-hint">Pilihan kurir dan pelacakan real-time belum terintegrasi.</p></section>}{stage==='payment' && <section className="checkout-section"><div className="checkout-title"><div><span className="eyebrow">Pilihan pembayaran aman</span><h2>Metode Pembayaran Midtrans Snap</h2></div></div><div style={{ display: 'grid', gap: '10px', marginBottom: '15px' }}><div className="shipping-option selected"><CreditCard size={18}/><span><b>Metode Pembayaran Lengkap</b><small>QRIS (GoPay, ShopeePay), Virtual Account (BCA, Mandiri, BNI, BRI), Kartu Kredit/Debit</small></span></div></div><div className="payment-disclaimer"><ShieldCheck/> Pembayaran diproses aman melalui Midtrans Snap. Total dihitung dan diverifikasi otomatis oleh server.</div></section>}<div className="checkout-nav"><button className="text-link" onClick={()=>stage==='address'?go('cart'):setStage(stage==='payment'?'shipping':'address')}><ArrowLeft size={15}/> Kembali</button><button className="button primary" onClick={next} disabled={checkoutBusy}>{checkoutBusy?'Membuat pesanan…':stage==='payment'?'Bayar Sekarang via Midtrans':'Lanjut'} <ArrowRight size={16}/></button></div></div><aside className="summary-card"><span className="eyebrow">Pilihan di dalam keranjang</span><h2>Ringkasan pesanan</h2><div className="checkout-items">{cartItems.map((p)=><div className="checkout-item" key={p.id}>{photo(p)}<span><b>{p.name}</b><small>Jumlah: {cart[p.id]}</small></span><strong>{money(p.price*cart[p.id])}</strong></div>)}</div><div className="summary-line"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-line"><span>Pengiriman</span><span>{shipping?money(shipping):'Gratis'}</span></div><div className="summary-divider"/><div className="summary-line total"><b>Total</b><b>{money(total)}</b></div><div className="secure-note"><ShieldCheck size={16}/> Informasi pembayaran terlindungi</div></aside></div></main>;
  }
  function Complete() {
    if (!createdOrder) return <main className="complete-page"><div className="empty-state"><PackageCheck/><h2>Belum ada pesanan</h2><p>Pesanan akan muncul di sini setelah checkout dibuat.</p><button className="button outline" onClick={()=>go('catalog')}>Jelajahi produk <ArrowRight size={16}/></button></div></main>;
    const isPaid = createdOrder.status === 'paid';
    const expiresAt = new Date(createdOrder.reservationExpiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (isPaid) {
      return (
        <main className="complete-page">
          <div className="complete-icon">
            <div style={{ background: '#2e7d32' }}><Check/></div>
            <Sparkles className="sparkle one"/><Sparkles className="sparkle two"/>
          </div>
          <span className="success-label" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
            Pembayaran Berhasil · Terverifikasi
          </span>
          <h1>Pesanan berhasil<br/><em>dikonfirmasi.</em></h1>
          <p className="complete-message">
            Terima kasih! Pembayaran paket <b>#{createdOrder.orderNumber}</b> telah terverifikasi dan pesanan akan segera diproses oleh artisan.
          </p>

          <div className="reward-card">
            <div className="reward-icon"><Sparkles/></div>
            <div className="reward-content">
              <div className="reward-heading">
                <h2>+500 Koin Sorelle <em>diterima</em></h2>
                <span>Hadiah Transaksi</span>
              </div>
              <p>Koin telah ditambahkan ke saldo akun Anda untuk potongan belanja berikutnya.</p>
            </div>
          </div>

          <section className="received-items order-created-card">
            <div className="received-head">
              <div>
                <span className="eyebrow">Ringkasan pesanan</span>
                <h2>{createdOrder.orderNumber}</h2>
              </div>
              <span className="state-pill" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Lunas</span>
            </div>
            <div className="summary-line"><span>Subtotal</span><span>{money(createdOrder.subtotalIdr)}</span></div>
            <div className="summary-line"><span>Pengiriman</span><span>{createdOrder.shippingIdr ? money(createdOrder.shippingIdr) : 'Gratis'}</span></div>
            <div className="summary-divider"/>
            <div className="summary-line total"><b>Total Pembayaran</b><b>{money(createdOrder.totalIdr)}</b></div>
          </section>

          <div className="receipt-actions">
            <button className="button primary" onClick={()=>go('review')}>Beri Ulasan Produk <ArrowRight size={15}/></button>
            <button className="button outline" onClick={()=>go('catalog')}>Kembali ke Katalog</button>
            <button className="text-link" onClick={()=>go('tracking')}>Lacak Pesanan <ArrowRight size={15}/></button>
          </div>
        </main>
      );
    }

    return (
      <main className="complete-page">
        <div className="complete-icon"><div><Clock3/></div></div>
        <span className="success-label">Menunggu Pembayaran</span>
        <h1>Pesanan dicatat,<br/><em>stok ditahan sementara.</em></h1>
        <p className="complete-message">
          Pesanan <b>{createdOrder.orderNumber}</b> dibuat. Silakan selesaikan pembayaran sebelum pukul {expiresAt} WIB agar reservasi stok tidak kedaluwarsa.
        </p>

        <section className="received-items order-created-card">
          <div className="received-head">
            <div>
              <span className="eyebrow">Ringkasan pesanan</span>
              <h2>{createdOrder.orderNumber}</h2>
            </div>
            <span className="state-pill">{createdOrder.status}</span>
          </div>
          <div className="summary-line"><span>Subtotal</span><span>{money(createdOrder.subtotalIdr)}</span></div>
          <div className="summary-line"><span>Pengiriman</span><span>{createdOrder.shippingIdr ? money(createdOrder.shippingIdr) : 'Gratis'}</span></div>
          <div className="summary-divider"/>
          <div className="summary-line total"><b>Total Menunggu Pembayaran</b><b>{money(createdOrder.totalIdr)}</b></div>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className="button primary"
              style={{ width: '100%', minHeight: '48px', fontSize: '13px' }}
              onClick={() => {
                if (createdOrder.snapToken) {
                  triggerSnapPayment(createdOrder.snapToken);
                } else {
                  void requestPaymentToken(createdOrder.orderNumber);
                }
              }}
            >
              Bayar Sekarang via Midtrans Snap <ArrowRight size={16}/>
            </button>
            <button
              className="button outline"
              style={{ width: '100%', minHeight: '42px', fontSize: '11px' }}
              onClick={() => void checkOrderStatus()}
            >
              Cek Status Pembayaran
            </button>
          </div>

          <div className="payment-disclaimer">
            <ShieldCheck/> Selesaikan transaksi via QRIS, Virtual Account bank, atau kartu debit/kredit di pop-up Midtrans Snap.
          </div>
        </section>

        <p className="protection-note">Reservasi stok otomatis dilepas jika pesanan tidak dibayar dalam 15 menit.</p>
        <div className="receipt-actions">
          <button className="button outline" onClick={()=>go('catalog')}>Kembali ke katalog</button>
          <button className="text-link" onClick={()=>go('account')}>Ke akun <ArrowRight size={15}/></button>
        </div>
      </main>
    );
  }  function Review() {
    return <main className="review-page"><div className="breadcrumbs"><button onClick={()=>go('complete')}>Pesanan selesai</button><ChevronRight size={14}/><span>Tulis ulasan</span></div><div className="review-intro"><div className="review-intro-icon"><Star/></div><span className="eyebrow">Setiap cerita punya arti</span><h1>Ceritakan pengalamanmu <em>kepada artisan.</em></h1><p>Ulasanmu membantu pengrajin lokal tumbuh dan membantu pembeli lain memilih dengan yakin.</p></div><section className="review-form-card"><div className="review-product-ref">{photo(selected)}<div><span className="eyebrow">Sorelle Artisan Living</span><b>{selected.name}</b><small>Pesanan #SOR-2026-104827</small></div><BadgeCheck/></div><fieldset className="rating-field"><legend>Bagaimana pengalamanmu?</legend><div className="review-stars">{[1,2,3,4,5].map((n)=><button key={n} aria-label={`${n} dari 5 bintang`} aria-pressed={rating===n} className={rating>=n?'selected':''} onClick={()=>setRating(n)}><Star fill="currentColor"/></button>)}</div><div className="rating-caption">{rating===0?'Pilih penilaianmu':(['','Kurang puas','Bisa lebih baik','Cukup baik','Menyenangkan','Sangat memuaskan'][rating])}</div></fieldset><div className="sentiment-field"><h2>Kesan cepat</h2><p>Pilih beberapa yang paling sesuai.</p><div className="sentiment-chips">{['Kualitas baik','Dibungkus rapi','Sesuai foto','Artisan ramah','Pengiriman aman','Bahan terasa premium'].map((x)=><button className={review.includes(x)?'active':''} key={x} onClick={()=>setReview((v)=>v.includes(x)?v.replace(x,''):v+` ${x}`)}>{review.includes(x)&&<Check size={13}/>} {x}</button>)}</div></div><label className="review-text-label">Ceritamu <span>opsional</span><textarea rows={5} placeholder="Apa yang kamu sukai dari pilihan ini? Ceritakan kepada artisan dan komunitas Sorelle." value={review.replace(/(Kualitas baik|Dibungkus rapi|Sesuai foto|Artisan ramah|Pengiriman aman|Bahan terasa premium)/g,'').trim()} onChange={(e)=>setReview(e.target.value)}/></label><label className="upload-zone"><input type="file" accept="image/*,video/*" multiple onChange={(e)=>e.target.files?.length&&setNotice(`${e.target.files.length} media dipilih. Upload aktif setelah backend tersedia.`)}/><span className="upload-icon"><Plus/></span><b>Tambahkan foto atau video</b><span>Tunjukkan pilihanmu di rumah · maks. 5 berkas</span></label><div className="store-rating"><h2>Pengalaman dengan Sorelle</h2><div>{[1,2,3,4,5].map((n)=><button key={n} className={rating>=n?'selected':''} aria-label={`Penilaian toko ${n} bintang`} onClick={()=>setRating(n)}><Star fill="currentColor"/></button>)}</div><small>Ulasan tentang layanan dan pengiriman</small></div><div className="review-consent"><ShieldCheck/> Ulasan akan ditampilkan tanpa membagikan informasi pribadi pesanan.</div><button className="button primary submit-review" onClick={()=>{if(!rating){setNotice('Pilih jumlah bintang terlebih dahulu.');return;}setNotice('Terima kasih. Ulasan tersimpan di demo ini.');go('complete');}}>Kirim ulasan <ArrowRight size={17}/></button></section><p className="review-footer-note">Ulasan jujur dan santun membuat ruang ini lebih baik untuk semua.</p></main>;
  }
  async function loadTrackingData() {
    if (!supabase) return;
    setTrackingLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/tracking', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.order) {
        setTrackingOrder(json.order);
        setTrackingEvents(json.checkpoints || []);
      } else {
        setTrackingOrder(null);
        setTrackingEvents([]);
      }
    } catch (err) {
      console.error('Failed to load tracking data:', err);
    } finally {
      setTrackingLoading(false);
    }
  }

  async function simulateNextCheckpoint() {
    if (!trackingOrder || !supabase) return;
    setTrackingSimulating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sesi berakhir. Silakan masuk kembali.');
      const res = await fetch('/api/tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orderId: trackingOrder.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menambahkan checkpoint.');
      setNotice(json.message);
      await loadTrackingData();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal simulasi tracking.');
    } finally {
      setTrackingSimulating(false);
    }
  }

  function Tracking() {
    if (!authUser) {
      return (
        <main className="tracking-page">
          <div className="breadcrumbs">
            <button onClick={() => go('home')}>Beranda</button>
            <ChevronRight size={14} />
            <span>Pesanan saya</span>
          </div>
          <div className="empty-state">
            <Truck />
            <h2>Masuk untuk melacak pesanan</h2>
            <p>Silakan masuk ke akun Anda untuk melihat status dan linimasa pengiriman kurir.</p>
            <button className="button primary" onClick={() => go('login')}>
              Masuk / Daftar <ArrowRight size={16} />
            </button>
          </div>
        </main>
      );
    }

    if (trackingLoading) {
      return (
        <main className="tracking-page">
          <div className="empty-state">
            <Clock3 />
            <h2>Memuat pelacakan paket…</h2>
          </div>
        </main>
      );
    }

    if (!trackingOrder) {
      return (
        <main className="tracking-page">
          <div className="breadcrumbs">
            <button onClick={() => go('home')}>Beranda</button>
            <ChevronRight size={14} />
            <span>Pesanan saya</span>
          </div>
          <div className="empty-state">
            <PackageCheck />
            <h2>Belum ada pesanan yang sedang dikirim</h2>
            <p>Selesaikan checkout pesanan untuk melacak posisi kurir di halaman ini.</p>
            <button className="button primary" onClick={() => go('catalog')}>
              Jelajahi Produk <ArrowRight size={16} />
            </button>
          </div>
        </main>
      );
    }

    const addr = (trackingOrder.shipping_address || {}) as Record<string, unknown>;
    const destinationText = `${addr.street || ''}, ${addr.city || ''}, ${addr.province || ''}`.trim() || 'Alamat Penerima';
    const courierDisplay = trackingOrder.courier || 'SiCepat Reguler';
    const resiDisplay = trackingOrder.tracking_number || 'Sedang Dialokasikan';

    return (
      <main className="tracking-page">
        <div className="breadcrumbs">
          <button onClick={() => go('home')}>Beranda</button>
          <ChevronRight size={14} />
          <span>Pesanan saya</span>
        </div>

        <div className="page-heading">
          <div>
            <span className="eyebrow">Integrasi Biteship Sandbox</span>
            <h1>Pesanan <em>di perjalanan.</em></h1>
            <p>Perjalanan paket kurir dari studio artisan ke rumah Anda.</p>
          </div>
        </div>

        <div className="tracking-layout">
          <div>
            <section className="tracking-status">
              <div className="tracking-status-head">
                <div className="tracking-status-icon"><Truck /></div>
                <div>
                  <span className="eyebrow">Pesanan #{trackingOrder.order_number}</span>
                  <h2>{trackingOrder.status === 'delivered' ? 'Paket Telah Sampai di Tujuan' : 'Kurir Sedang Memproses Paket'}</h2>
                  <p>{trackingOrder.status === 'delivered' ? 'Pesanan telah diterima oleh penerima.' : `Estimasi tiba segera · Area tujuan: ${String(addr.city || 'Tujuan')}`}</p>
                </div>
                <span className="state-pill" style={{ textTransform: 'capitalize' }}>
                  {trackingOrder.status.replace('_', ' ')}
                </span>
              </div>

              <div className="map-placeholder">
                <div className="map-grid" />
                <div className="map-route">
                  <span className="map-start"><House /></span>
                  <span className="map-truck"><Truck /></span>
                  <span className="map-end"><MapPin /></span>
                </div>
                <div className="map-label map-origin">Studio Sorelle<br />Bantul, DIY</div>
                <div className="map-label map-destination">{destinationText.slice(0, 30)}</div>
                <div className="map-eta"><Clock3 /> {trackingOrder.status === 'delivered' ? 'Selesai' : 'Kurir Bergerak'}</div>
              </div>

              <div className="courier-card">
                <div className="courier-avatar">SC</div>
                <div>
                  <span className="eyebrow">Jasa Pengiriman Resmi</span>
                  <b>{courierDisplay}</b>
                  <span>No. Resi: <strong>{resiDisplay}</strong></span>
                </div>
                <div className="courier-actions">
                  <button
                    onClick={() => {
                      if (trackingOrder.tracking_number) {
                        void navigator.clipboard.writeText(trackingOrder.tracking_number);
                        setNotice(`Resi ${trackingOrder.tracking_number} disalin!`);
                      }
                    }}
                  >
                    Salin Resi
                  </button>
                </div>
              </div>
            </section>

            <section className="timeline-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <span className="eyebrow">Linimasa Ekspedisi</span>
                  <h2 style={{ margin: '4px 0 0 0' }}>Langkah Perjalanan</h2>
                </div>
                <button
                  className="button primary"
                  style={{ minHeight: '34px', fontSize: '9px', padding: '0 12px' }}
                  disabled={trackingSimulating || trackingOrder.status === 'delivered'}
                  onClick={() => void simulateNextCheckpoint()}
                >
                  {trackingSimulating ? 'Memperbarui…' : trackingOrder.status === 'delivered' ? 'Paket Selesai' : 'Simulasi Checkpoint Kurir'}
                </button>
              </div>

              <div className="timeline">
                {trackingEvents.length > 0 ? (
                  trackingEvents.map((event, i) => (
                    <div className={`timeline-entry ${i === 0 ? 'current' : ''}`} key={event.id}>
                      <span className="timeline-dot">{i === 0 ? <Truck size={14} /> : <Check size={13} />}</span>
                      <div>
                        <b>{event.description}</b>
                        <span>
                          {event.location ? `${event.location} · ` : ''}
                          {new Date(event.event_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="timeline-entry current">
                    <span className="timeline-dot"><Truck size={14} /></span>
                    <div>
                      <b>Pesanan terkonfirmasi dan sedang dipersiapkan oleh Sorelle Artisan.</b>
                      <span>{new Date(trackingOrder.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="tracking-package-note">
                <PackageCheck />
                <span>
                  <b>Paket Dijaga Sepenuh Hati</b>
                  <small>Dikemas aman dengan bahan ramah lingkungan khas Sorelle.</small>
                </span>
              </div>
            </section>
          </div>

          <aside className="summary-card tracking-summary">
            <span className="eyebrow">Tujuan Pengiriman</span>
            <h2>Detail Paket</h2>
            <div className="summary-line"><span>Penerima</span><b>{trackingOrder.shipping_name}</b></div>
            <div className="summary-line"><span>Telepon</span><span>{trackingOrder.shipping_phone}</span></div>
            <div className="summary-line"><span>Alamat</span><span style={{ maxWidth: '160px', textAlign: 'right' }}>{destinationText}</span></div>
            <div className="summary-divider" />
            <div className="summary-line"><span>Ekspedisi</span><b>{courierDisplay}</b></div>
            <div className="summary-line"><span>No. Resi</span><b>{resiDisplay}</b></div>
            <div className="summary-line"><span>Status</span><b style={{ textTransform: 'capitalize' }}>{trackingOrder.status.replace('_', ' ')}</b></div>
            <button className="button outline" style={{ marginTop: '14px', width: '100%' }} onClick={() => void loadTrackingData()}>
              Segarkan Pelacakan
            </button>
          </aside>
        </div>
      </main>
    );
  }
  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setAuthMessage('Supabase belum dikonfigurasi. Periksa .env.local.'); return; }
    setAuthBusy(true);
    setAuthMessage('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName }, emailRedirectTo: `${window.location.origin}/` } });
        if (error) throw error;
        if (!data.session) setAuthMessage('Akun dibuat. Periksa email untuk mengonfirmasi akun sebelum masuk.');
        else { setAuthMessage('Akun berhasil dibuat.'); go('account'); }
      } else if (authMode === 'update') {
        const { error } = await supabase.auth.updateUser({ password: authPassword });
        if (error) throw error;
        setAuthMessage('Kata sandi berhasil diperbarui.');
        setAuthMode('login');
        setAuthPassword('');
      } else if (authMode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: `${window.location.origin}/?password-recovery=1` });
        if (error) throw error;
        setAuthMessage('Jika alamat email terdaftar, tautan pemulihan akan dikirim.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setAuthMessage('Berhasil masuk.');
        go('account');
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Autentikasi gagal. Coba lagi.');
    } finally {
      setAuthBusy(false);
    }
  }
  function Login() {
    return <main className="auth-page"><div className="breadcrumbs"><button onClick={()=>go('home')}>Beranda</button><ChevronRight size={14}/><span>{authMode==='signup'?'Buat akun':'Masuk'}</span></div><section className="auth-layout"><div className="auth-visual"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1100&q=85" alt="Ruang keluarga hangat bernuansa alam"/><div><span className="eyebrow">Ruang yang terasa seperti rumah</span><h1>Hal-hal baik<br/>menemukan <em>rumahnya.</em></h1><p>Masuk untuk menyimpan pilihan dan mengikuti pesanan Sorelle.</p></div></div><div className="auth-panel"><span className="eyebrow">Senang melihatmu kembali</span><h2>{authMode==='signup'?'Buat ruangmu di Sorelle':authMode==='reset'?'Atur ulang kata sandi':authMode==='update'?'Buat kata sandi baru':'Masuk ke akunmu'}</h2><p>{authMode==='signup'?'Bergabung untuk menyimpan pilihan baikmu.':authMode==='reset'?'Kami akan mengirim tautan pemulihan ke emailmu.':authMode==='update'?'Pilih kata sandi baru untuk akunmu.':'Lanjutkan perjalanan pilihanmu.'}</p><form onSubmit={submitAuth} className="auth-form">{authMode==='signup'&&<label>Nama lengkap<input autoComplete="name" value={authName} onChange={(e)=>setAuthName(e.target.value)} required/></label>}{authMode!=='update'&&<label>Email<input type="email" autoComplete="email" value={authEmail} onChange={(e)=>setAuthEmail(e.target.value)} required/></label>}{authMode!=='reset'&&<label>Kata sandi<input type="password" autoComplete={authMode==='signup'||authMode==='update'?'new-password':'current-password'} minLength={8} value={authPassword} onChange={(e)=>setAuthPassword(e.target.value)} required/><small>Minimal 8 karakter.</small></label>}{authMode==='login'&&<button type="button" className="auth-forgot" onClick={()=>{setAuthMode('reset');setAuthMessage('');}}>Lupa kata sandi?</button>}<button className="button primary auth-submit" type="submit" disabled={authBusy}>{authBusy?'Memproses…':authMode==='signup'?'Buat akun':authMode==='reset'?'Kirim tautan pemulihan':authMode==='update'?'Simpan kata sandi':'Masuk'} <ArrowRight size={16}/></button></form>{authMessage&&<p className="auth-message" role="status">{authMessage}</p>}<div className="auth-switch">{authMode==='signup'?'Sudah punya akun?':authMode==='reset'||authMode==='update'?'Kembali ke masuk?':'Belum punya akun?'} <button onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setAuthMessage('');}}>{authMode==='login'?'Daftar': 'Masuk'}</button></div><div className="auth-safety"><ShieldCheck/> Kata sandi diproses aman oleh Supabase Auth.</div></div></section></main>;
  }
  function Account() {
    if (!authUser) return <main className="account-page"><div className="empty-state"><UserRound/><h2>Masuk untuk melihat akunmu</h2><p>Simpan alamat dan ikuti perjalanan pesanan Sorelle.</p><button className="button primary" onClick={()=>go('login')}>Masuk / daftar <ArrowRight size={16}/></button></div></main>;
    return <main className="account-page"><div className="account-hero"><div className="account-avatar">{(authUser.user_metadata?.full_name as string | undefined)?.[0] ?? authUser.email?.[0]?.toUpperCase() ?? 'S'}</div><div><span className="eyebrow">Akun Sorelle</span><h1>{(authUser.user_metadata?.full_name as string | undefined) || authUser.email}</h1><p>{authUser.email}</p></div><button className="button outline" onClick={async()=>{await supabase?.auth.signOut();go('home');}}>Keluar</button></div><div className="empty-state"><PackageCheck/><h2>Pesanan akan tampil di sini</h2><p>Halaman riwayat pesanan masih menunggu integrasi backend.</p><button className="button outline" onClick={()=>go('catalog')}>Jelajahi produk <ArrowRight size={16}/></button></div></main>;
  }
  const content: Record<View, () => React.ReactNode> = { home:Home,catalog:Catalog,product:ProductDetail,cart:Cart,checkout:Checkout,complete:Complete,review:Review,tracking:Tracking,account:Account,login:Login };
  const Page = content[view];
  return <>{Header()}{!supabase&&<div className="catalog-notice" role="status">Mode pratinjau memakai produk contoh. Isi `.env.local` untuk memuat katalog Supabase.</div>}{catalogLoading&&<div className="catalog-notice" role="status">Memuat katalog dari Supabase…</div>}{catalogError&&<div className="catalog-notice error" role="alert">Katalog gagal dimuat: {catalogError}. Periksa URL/key dan kebijakan RLS Supabase.</div>}{!catalogLoading&&supabase&&!catalogError&&products.length===0&&<div className="catalog-notice" role="status">Belum ada produk aktif di Supabase. Tambahkan produk, lalu set status toko dan produk menjadi active.</div>}{Page()}{Footer()}<nav className="mobile-tabbar" aria-label="Navigasi bawah">{[{label:'Beranda',icon:<House/>,v:'home' as View},{label:'Jelajahi',icon:<Search/>,v:'catalog' as View},{label:'Pesanan',icon:<PackageCheck/>,v:'tracking' as View},{label:'Keranjang',icon:<ShoppingBag/>,v:'cart' as View},{label:'Akun',icon:<UserRound/>,v:'account' as View}].map((t)=><button className={view===t.v?'active':''} key={t.label} onClick={()=>go(t.v)}>{t.icon}<span>{t.label}</span>{t.v==='cart'&&count>0&&<i>{count}</i>}</button>)}</nav>{notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Tutup"><X size={16}/></button></div>}</>;
}
