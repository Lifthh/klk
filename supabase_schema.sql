-- ==============================================================
-- SQL SETUP UNTUK K.L.K MEMORIES (JALANKAN DI SUPABASE SQL EDITOR)
-- ==============================================================

-- 1. Tabel Kategori
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabel Produk
create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  price numeric not null default 0,
  "desc" text default '',
  image text default '',
  image2 text default '',
  image3 text default '',
  active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Aktifkan Row Level Security (RLS)
alter table public.categories enable row level security;
alter table public.products enable row level security;

-- 4. Kebijakan Keamanan (RLS Policies)
-- Pengunjung / Publik BISA MELIHAT kategori & produk
create policy "Siapa saja bisa melihat kategori"
  on public.categories for select
  using (true);

create policy "Siapa saja bisa melihat produk aktif"
  on public.products for select
  using (true);

-- Hanya Owner (yang login) yang BISA MENAMBAH, MENGUBAH, & MENGHAPUS
create policy "Owner bisa kelola kategori"
  on public.categories for all
  to authenticated
  using (true)
  with check (true);

create policy "Owner bisa kelola produk"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

-- 5. Data Awal Kategori & Contoh Produk
insert into public.categories (name)
values 
  ('Frame foto'),
  ('Gantungan kunci'),
  ('Aksesoris')
on conflict (name) do nothing;

insert into public.products (name, category, price, "desc", image, active)
values 
  ('Frame Pink "My Girl"', 'Frame foto', 25000, 'Contoh produk pertama kamu. Ubah atau tambahkan produk baru lewat panel admin.', '', true);

-- 6. Storage Bucket untuk Foto Produk
-- Membuat bucket public bernama 'product-images' jika belum ada
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Kebijakan Storage: Publik bisa melihat foto
create policy "Foto produk bisa dilihat publik"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Kebijakan Storage: Hanya owner yang login yang bisa upload / hapus foto
create policy "Owner bisa upload foto produk"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "Owner bisa hapus foto produk"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
