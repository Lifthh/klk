# K.L.K Memories | Product Showcase

Web katalog showcase produk untuk **K.L.K Memories** dengan manajemen produk berbasis Supabase & Vanilla JavaScript.

## 🛠️ Tech Stack
* **Frontend**: HTML5, Vanilla JavaScript (ES6+), CSS3 (Modern Responsive)
* **Backend & Database**: [Supabase](https://supabase.com) (PostgreSQL Database & Storage Bucket)
* **Hosting**: Vercel / Static Hosting

## 🚀 Cara Menjalankan di Lokal

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/Lifthh/klk.git
   ```
2. **Jalankan web:**
   * Pindahkan folder ke `C:/laragon/www/klk` (jika menggunakan Laragon).
   * Buka browser dan akses: `http://localhost/klk` (atau `http://klk.test`).
   * Atau gunakan extension **Live Server** di VS Code dan buka `index.html`.

## 🔐 Akses Admin / Kelola Produk
* Akses URL rahasia: `http://localhost/klk/#/login`
* Atau klik **logo toko 3 kali berturut-turut** di header pada halaman utama.

## 🤝 Alur Kolaborasi (Git Workflow)
Untuk mencegah bentrok kode (*merge conflict*), ikuti alur berikut:

1. **Selalu tarik update terbaru sebelum ngoding:**
   ```bash
   git pull origin main
   ```
2. **Buat branch baru untuk fitur yang mau dikerjakan:**
   ```bash
   git checkout -b nama-fitur-baru
   # Contoh: git checkout -b perbaikan-responsive
   ```
3. **Commit perubahan:**
   ```bash
   git add .
   git commit -m "feat: deskripsi perubahan"
   ```
4. **Push branch ke GitHub:**
   ```bash
   git push origin nama-fitur-baru
   ```
5. Buka GitHub dan buat **Pull Request (PR)** ke branch `main`.
