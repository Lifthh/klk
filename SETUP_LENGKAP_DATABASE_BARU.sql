-- ==============================================================================
-- SETUP LENGKAP DATABASE SUPABASE UNTUK K.L.K MEMORIES
-- Jalankan SEMUA query ini sekaligus di menu "SQL Editor" pada Supabase Anda.
-- ==============================================================================

-- 1. TABEL KATEGORI (Mendukung Keychain & Ucapan Digital)
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  type text default 'keychain',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create unique index if not exists categories_name_type_idx on public.categories (name, coalesce(type, 'keychain'));

-- 2. TABEL PRODUK
create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  price numeric not null default 0,
  "desc" text default '',
  link text default '',
  product_type text default 'keychain',
  image text default '',
  image2 text default '',
  image3 text default '',
  active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. TABEL ULASAN / TESTIMONI
create table if not exists public.reviews (
  id text primary key default 'rev_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6),
  name text not null,
  product_name text default '',
  product_id bigint default null,
  rating integer not null default 5 check (rating >= 1 and rating <= 5),
  comment text not null,
  photos text[] default '{}',
  likes integer not null default 0,
  date text default to_char(now(), 'DD Mon YYYY'),
  admin_reply text default null,
  admin_reply_at timestamp with time zone default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. AKTIFKAN ROW LEVEL SECURITY (RLS)
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;

-- 5. KEBIJAKAN IZIN (POLICIES) TABEL KATEGORI & PRODUK
drop policy if exists "Kelola kategori bebas" on public.categories;
drop policy if exists "Owner bisa kelola kategori" on public.categories;
drop policy if exists "Siapa saja bisa melihat kategori" on public.categories;
create policy "Kelola kategori bebas"
  on public.categories for all using (true) with check (true);

drop policy if exists "Kelola produk bebas" on public.products;
drop policy if exists "Owner bisa kelola produk" on public.products;
drop policy if exists "Siapa saja bisa melihat produk aktif" on public.products;
create policy "Kelola produk bebas"
  on public.products for all using (true) with check (true);

-- 6. KEBIJAKAN IZIN TABEL ULASAN / REVIEWS
drop policy if exists "Siapa saja bisa melihat ulasan" on public.reviews;
create policy "Siapa saja bisa melihat ulasan"
  on public.reviews for select using (true);

drop policy if exists "Siapa saja bisa menulis ulasan" on public.reviews;
create policy "Siapa saja bisa menulis ulasan"
  on public.reviews for insert with check (true);

drop policy if exists "Siapa saja bisa update ulasan" on public.reviews;
create policy "Siapa saja bisa update ulasan"
  on public.reviews for update using (true) with check (true);

drop policy if exists "Owner bisa hapus ulasan" on public.reviews;
create policy "Owner bisa hapus ulasan"
  on public.reviews for delete using (true);

-- 7. DATA AWAL KATEGORI & CONTOH PRODUK
insert into public.categories (name, type)
values 
  ('Frame foto', 'keychain'),
  ('Gantungan kunci', 'keychain'),
  ('Aksesoris', 'keychain'),
  ('Galery', 'ucapan'),
  ('Ucapan Ulangtahun', 'ucapan')
on conflict do nothing;

insert into public.products (name, category, price, "desc", image, active, product_type)
values 
  ('Frame Pink "My Girl"', 'Frame foto', 25000, 'Contoh produk pertama. Ubah atau tambahkan produk baru lewat panel admin.', '', true, 'keychain')
on conflict do nothing;

-- 8. STORAGE BUCKET UNTUK FOTO PRODUK & ULASAN
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Kebijakan Storage Foto
drop policy if exists "Foto produk bisa dilihat publik" on storage.objects;
create policy "Foto produk bisa dilihat publik"
  on storage.objects for select using (bucket_id = 'product-images');

drop policy if exists "Bebas upload foto produk" on storage.objects;
create policy "Bebas upload foto produk"
  on storage.objects for insert with check (bucket_id = 'product-images');

drop policy if exists "Bebas hapus foto produk" on storage.objects;
create policy "Bebas hapus foto produk"
  on storage.objects for delete using (bucket_id = 'product-images');
