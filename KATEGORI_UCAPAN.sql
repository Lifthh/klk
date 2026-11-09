-- ==============================================================
-- UPDATE DATABASE SUPABASE UNTUK KATEGORI UCAPAN DIGITAL
-- (Jalankan query ini di Supabase SQL Editor jika ingin database cloud tersinkronisasi)
-- ==============================================================

-- 1. Tambah kolom 'type' ke tabel categories (default 'keychain')
alter table public.categories add column if not exists type text default 'keychain';

-- 2. Lepas batas UNIQUE constraint lama pada kolom name agar nama kategori tidak bentrok
alter table public.categories drop constraint if exists categories_name_key;

-- 3. Buat index UNIQUE gabungan (name + type)
create unique index if not exists categories_name_type_idx 
  on public.categories (name, coalesce(type, 'keychain'));

-- 4. Masukkan data awal kategori Ucapan Digital
insert into public.categories (name, type)
values 
  ('Galery', 'ucapan'),
  ('Ucapan Ulangtahun', 'ucapan')
on conflict do nothing;

-- 5. Pastikan semua izin RLS tabel categories terbuka untuk tambah, ubah, dan hapus
drop policy if exists "Owner bisa kelola kategori" on public.categories;
drop policy if exists "Siapa saja bisa melihat kategori" on public.categories;
drop policy if exists "Kelola kategori bebas" on public.categories;

create policy "Kelola kategori bebas"
  on public.categories
  for all
  using (true)
  with check (true);
