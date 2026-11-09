-- ==============================================================
-- JALANKAN QUERY INI DI SUPABASE SQL EDITOR
-- Agar kategori dan produk bisa ditambah, diubah, & dihapus dengan lancar
-- ==============================================================

-- 1. Tambah kolom 'type' ke tabel categories jika belum ada
alter table public.categories add column if not exists type text default 'keychain';
alter table public.categories drop constraint if exists categories_name_key;
create unique index if not exists categories_name_type_idx on public.categories (name, coalesce(type, 'keychain'));

-- 2. Tambah kategori ucapan default jika belum ada
insert into public.categories (name, type)
values 
  ('Galery', 'ucapan'),
  ('Ucapan Ulangtahun', 'ucapan')
on conflict do nothing;

-- 3. Perbarui izin tabel kategori (Bebaskan select, insert, update, & delete)
drop policy if exists "Owner bisa kelola kategori" on public.categories;
drop policy if exists "Siapa saja bisa melihat kategori" on public.categories;
drop policy if exists "Kelola kategori bebas" on public.categories;

create policy "Kelola kategori bebas"
  on public.categories
  for all
  using (true)
  with check (true);

-- 4. Perbarui izin tabel produk (Bebaskan update & delete)
drop policy if exists "Owner bisa kelola produk" on public.products;
drop policy if exists "Siapa saja bisa melihat produk aktif" on public.products;
drop policy if exists "Kelola produk bebas" on public.products;

create policy "Kelola produk bebas"
  on public.products
  for all
  using (true)
  with check (true);
