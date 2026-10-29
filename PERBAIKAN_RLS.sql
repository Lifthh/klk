-- ==============================================================
-- JALANKAN QUERY INI DI SUPABASE SQL EDITOR
-- Agar kategori dan produk bisa ditambah, diubah, & dihapus dengan lancar
-- ==============================================================

-- 1. Perbarui izin tabel kategori (Bebaskan delete & insert)
drop policy if exists "Owner bisa kelola kategori" on public.categories;
drop policy if exists "Siapa saja bisa melihat kategori" on public.categories;
drop policy if exists "Kelola kategori bebas" on public.categories;

create policy "Kelola kategori bebas"
  on public.categories
  for all
  using (true)
  with check (true);

-- 2. Perbarui izin tabel produk (Bebaskan update & delete)
drop policy if exists "Owner bisa kelola produk" on public.products;
drop policy if exists "Siapa saja bisa melihat produk aktif" on public.products;
drop policy if exists "Kelola produk bebas" on public.products;

create policy "Kelola produk bebas"
  on public.products
  for all
  using (true)
  with check (true);
