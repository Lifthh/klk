# Panduan Setup Supabase untuk K.L.K Memories

Web katalog kamu sekarang sudah dipisahkan kodenya dengan rapi dan siap dihubungkan ke Supabase & Vercel.

---

### Langkah 1: Buat Akun & Project di Supabase
1. Buka [supabase.com](https://supabase.com) dan login/signup (bisa pakai akun Google / GitHub).
2. Klik tombol **New Project**.
3. Isi nama project: `klk-memories`.
4. Buat database password (simpan password ini di catatan pribadi).
5. Pilih region terdekat (misal: **Singapore**).
6. Klik **Create new project** dan tunggu 1-2 menit sampai selesai disiapkan.

---

### Langkah 2: Jalankan Script Database (SQL)
1. Di dashboard Supabase, klik menu **SQL Editor** (ikon terminal/lembaran kode di sidebar kiri).
2. Klik **New Query**.
3. Buka file `supabase_schema.sql` yang ada di folder project ini, copy semua isinya, lalu paste ke SQL Editor Supabase.
4. Klik tombol **Run** (atau tekan `Ctrl + Enter`).
5. Selesai! Tabel `products`, `categories`, dan folder foto `product-images` sudah otomatis terbuat dengan keamanan lengkap.

---

### Langkah 3: Buat Akun Login Owner
Supaya kamu bisa login sebagai owner untuk menambah produk:
1. Di dashboard Supabase, klik menu **Authentication** (sidebar kiri) -> **Users**.
2. Klik tombol **Add user** -> pilih **Create user**.
3. Masukkan **Email kamu** dan **Password kamu** yang ingin kamu pakai untuk login.
4. Klik **Create user**.

---

### Langkah 4: Masukkan Kunci API ke `js/config.js`
1. Di Supabase, klik menu **Project Settings** (ikon gerigi di kiri bawah) -> **API**.
2. Cari bagian **Project URL**, lalu copy URL-nya (misal: `https://xyzabc.supabase.co`).
3. Cari bagian **Project API Keys**, copy bagian **`anon` `public`**.
4. Buka file `js/config.js` di folder project kamu, lalu ganti:
   ```javascript
   const SUPABASE_CONFIG = {
     url: 'PASTE_PROJECT_URL_DI_SINI',
     anonKey: 'PASTE_ANON_KEY_DI_SINI'
   };
   ```
5. Simpan file `js/config.js`.

---

### Cara Masuk ke Halaman Admin (Rahasia):
Karena tombol login sudah disembunyikan dari pengunjung biasa:
1. **Cara 1:** Tambahkan `#/login` di belakang link web kamu (contoh: `https://namatoko.vercel.app/#/login`).
2. **Cara 2 (Shortcut Rahasia):** Klik logo toko K.L.K **3 kali berturut-turut** dengan cepat, maka halaman login akan otomatis terbuka!
