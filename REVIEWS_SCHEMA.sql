-- ==============================================================
-- TAMBAHKAN TABEL ULASAN/REVIEWS KE SUPABASE
-- Jalankan query ini di Supabase SQL Editor
-- ==============================================================

-- 1. Buat tabel reviews
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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Aktifkan Row Level Security
alter table public.reviews enable row level security;

-- 3. Kebijakan: Siapa saja bisa MELIHAT ulasan
create policy "Siapa saja bisa melihat ulasan"
  on public.reviews for select
  using (true);

-- 4. Kebijakan: Siapa saja bisa MENULIS ulasan (pembeli tidak perlu login)
create policy "Siapa saja bisa menulis ulasan"
  on public.reviews for insert
  with check (true);

-- 5. Kebijakan: Siapa saja bisa UPDATE (untuk fitur like)
create policy "Siapa saja bisa update ulasan"
  on public.reviews for update
  using (true)
  with check (true);

-- 6. Kebijakan: Hanya owner yang login bisa HAPUS ulasan
create policy "Owner bisa hapus ulasan"
  on public.reviews for delete
  to authenticated
  using (true);

-- 7. Storage: izinkan upload foto ulasan ke bucket product-images/reviews/
-- (menggunakan bucket yang sama agar tidak perlu buat bucket baru)
create policy "Siapa saja bisa upload foto ulasan"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = 'reviews');
