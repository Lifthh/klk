// ==============================================================
// API & DATA LAYER (SUPABASE + FALLBACK MOCK)
// ==============================================================

// Seed cadangan jika Supabase belum dihubungkan
const MOCK_PRODUCTS = [
  {
    id: 1,
    name: 'Frame Pink "My Girl"',
    category: 'Frame foto',
    price: 25000,
    desc: 'Contoh produk bawaan. Hubungkan Supabase untuk mulai menyimpan produk sungguhan ke cloud.',
    image: '',
    image2: '',
    image3: '',
    active: true
  }
];

const MOCK_CATEGORIES = ['Frame foto', 'Gantungan kunci', 'Aksesoris'];

// Helper Kompresi Gambar ke Blob (agar upload ke Supabase ringan dan cepat)
function compressImageToBlob(file, max = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Gagal mengompres gambar'));
        }, 'image/jpeg', 0.85);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ----------------- AUTH (OWNER / ADMIN) -----------------
async function apiGetSession() {
  if (!supabaseClient) {
    // Mode demo lokal jika belum konek supabase
    return sessionStorage.getItem('klk_demo_auth') === '1' ? { user: { email: 'owner@klk.com' } } : null;
  }
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error || !session) return null;
  return session;
}

async function apiLogin(email, password) {
  if (!supabaseClient) {
    // Mode demo sementara jika belum isi config
    if (email === 'admin@klk.com' && password === 'admin123') {
      sessionStorage.setItem('klk_demo_auth', '1');
      return { user: { email } };
    }
    throw new Error('Supabase belum diatur. Gunakan admin@klk.com / admin123 untuk mode demo.');
  }
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function apiLogout() {
  if (!supabaseClient) {
    sessionStorage.removeItem('klk_demo_auth');
    return;
  }
  await supabaseClient.auth.signOut();
}

// Helper Deteksi Tipe Produk
function isUcapanProduct(p) {
  if (!p) return false;
  if (p.product_type === 'ucapan') return true;
  if (p.category === 'Galery' || p.category === 'Ucapan Ulangtahun') return true;
  if (p.link && String(p.link).trim().length > 0) return true;
  return false;
}

function isKeychainProduct(p) {
  return !isUcapanProduct(p);
}

const UCAPAN_CATEGORIES = ['Galery', 'Ucapan Ulangtahun'];

// ----------------- PRODUK -----------------
async function apiGetProducts() {
  let data = [];
  if (!supabaseClient) {
    try {
      const cached = localStorage.getItem('klk_mock_products');
      if (cached) data = JSON.parse(cached);
      else data = MOCK_PRODUCTS;
    } catch (_) {
      data = MOCK_PRODUCTS;
    }
  } else {
    const { data: sbData, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    data = sbData || [];
  }

  // Parse web link jika tersimpan di dalam deskripsi
  return data.map(p => {
    let link = p.link || '';
    let desc = p.desc || '';
    if (!link && desc && desc.includes('[web_link:')) {
      const m = desc.match(/\[web_link:\s*(.*?)\s*\]/);
      if (m) {
        link = m[1].trim();
        desc = desc.replace(/\[web_link:.*?\]/g, '').trim();
      }
    }
    return { ...p, link, desc };
  });
}

async function apiSaveProduct(product, editId = null) {
  if (!supabaseClient) {
    let list = await apiGetProducts();
    if (editId) {
      list = list.map(p => p.id === editId ? { ...p, ...product } : p);
    } else {
      list = [{ id: Date.now(), active: true, ...product }, ...list];
    }
    localStorage.setItem('klk_mock_products', JSON.stringify(list));
    return;
  }

  // Coba kirim langsung ke Supabase
  try {
    if (editId) {
      const { error } = await supabaseClient
        .from('products')
        .update(product)
        .eq('id', editId);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from('products')
        .insert([{ ...product, active: true }]);
      if (error) throw error;
    }
  } catch (err) {
    // Fallback jika Supabase belum memiliki kolom 'link' atau 'product_type'
    if (err && (err.message?.includes('column') || err.code === 'PGRST204')) {
      const { link, product_type, ...safeProduct } = product;
      let safeDesc = safeProduct.desc || '';
      if (link) {
        safeDesc = safeDesc.replace(/\[web_link:.*?\]/g, '').trim() + `\n[web_link:${link}]`;
      }
      safeProduct.desc = safeDesc;

      if (editId) {
        const { error } = await supabaseClient.from('products').update(safeProduct).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('products').insert([{ ...safeProduct, active: true }]);
        if (error) throw error;
      }
    } else {
      throw err;
    }
  }
}

async function apiToggleProduct(id, newStatus) {
  if (!supabaseClient) {
    let list = await apiGetProducts();
    list = list.map(p => p.id === id ? { ...p, active: newStatus } : p);
    localStorage.setItem('klk_mock_products', JSON.stringify(list));
    return;
  }
  const { error } = await supabaseClient
    .from('products')
    .update({ active: newStatus })
    .eq('id', id);
  if (error) throw error;
}

async function apiDeleteProduct(id) {
  if (!supabaseClient) {
    let list = await apiGetProducts();
    list = list.filter(p => p.id !== id);
    localStorage.setItem('klk_mock_products', JSON.stringify(list));
    return;
  }
  const { error } = await supabaseClient
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ----------------- KATEGORI -----------------
async function apiGetCategories() {
  if (!supabaseClient) {
    try {
      const cached = localStorage.getItem('klk_mock_cats');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return MOCK_CATEGORIES;
  }
  const { data, error } = await supabaseClient
    .from('categories')
    .select('name')
    .order('name', { ascending: true });
  if (error) throw error;
  return data.map(c => c.name);
}

async function apiAddCategory(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;

  if (!supabaseClient) {
    let list = await apiGetCategories();
    if (!list.includes(trimmed)) {
      list.push(trimmed);
      localStorage.setItem('klk_mock_cats', JSON.stringify(list));
    }
    return;
  }
  const { error } = await supabaseClient
    .from('categories')
    .insert([{ name: trimmed }]);
  if (error) {
    if (error.code === '23505') throw new Error('Kategori sudah ada');
    throw error;
  }
}

async function apiDeleteCategory(name) {
  if (!supabaseClient) {
    let list = await apiGetCategories();
    list = list.filter(c => c !== name);
    localStorage.setItem('klk_mock_cats', JSON.stringify(list));
    return;
  }
  const { data, error } = await supabaseClient
    .from('categories')
    .delete()
    .eq('name', name)
    .select();

  if (error) throw error;
  if (data && data.length === 0) {
    throw new Error('Izin Supabase menolak penghapusan. Jalankan script SQL perbaikan izin RLS.');
  }
}

// ----------------- UPLOAD FOTO KE SUPABASE STORAGE -----------------
async function apiUploadImage(file) {
  if (!file) return '';
  const blob = await compressImageToBlob(file);

  if (!supabaseClient) {
    // Fallback DataURL sementara jika Supabase belum aktif
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });
  }

  const ext = 'jpg';
  const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const filePath = `products/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('product-images')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabaseClient.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrl;
}

// ==============================================================
// TESTIMONI & ULASAN PRODUK (PENYIMPANAN LOKAL / LOCALSTORAGE)
// ==============================================================
const TESTIMONIALS_KEY = 'klk_testimonials_v3';

// Bersihkan data dummy lama dari browser jika ada
try {
  localStorage.removeItem('klk_testimonials_v1');
  localStorage.removeItem('klk_testimonials_v2');
} catch (_) {}

// Data Ulasan Awal Dikosongkan (Sesuai Permintaan Pemilik Toko)
const DEFAULT_TESTIMONIALS = [];

// Helper Sensor Nama Pembeli (Contoh: "Lesmana" -> "L*****A")
function maskName(str) {
  if (!str) return 'P******I';
  const trimmed = str.trim();
  return trimmed.split(/\s+/).map(word => {
    if (word.length <= 1) return word + '*';
    if (word.length === 2) return word[0].toUpperCase() + '*';
    const first = word[0].toUpperCase();
    const last = word[word.length - 1].toUpperCase();
    const stars = '*'.repeat(word.length - 2);
    return `${first}${stars}${last}`;
  }).join(' ');
}

// Helper kompresi foto ulasan ke format Base64 ringan (30-60 KB per foto)
function compressImageToBase64(file, maxDimension = 680, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Ambil semua testimoni dari LocalStorage
function apiGetReviews() {
  try {
    const raw = localStorage.getItem(TESTIMONIALS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Gagal membaca ulasan dari localStorage:', err);
  }
  // Pasang data bawaan jika masih kosong
  try {
    localStorage.setItem(TESTIMONIALS_KEY, JSON.stringify(DEFAULT_TESTIMONIALS));
  } catch (_) {}
  return DEFAULT_TESTIMONIALS;
}

// Simpan ulasan baru pembeli ke LocalStorage
function apiSaveReview(review) {
  const list = apiGetReviews();
  const newReview = {
    id: 'testi_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    likes: 0,
    ...review
  };
  const updated = [newReview, ...list];
  try {
    localStorage.setItem(TESTIMONIALS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('LocalStorage penuh saat menyimpan foto ulasan:', err);
    throw new Error('Memori browser penuh. Coba kurangi foto atau kompres ukuran foto.');
  }
  return newReview;
}

// Tambah like "Membantu" pada ulasan
function apiLikeReview(id) {
  const list = apiGetReviews();
  const likedKey = 'klk_liked_reviews';
  let likedList = [];
  try {
    likedList = JSON.parse(localStorage.getItem(likedKey) || '[]');
  } catch (_) {}

  if (likedList.includes(id)) return false; // Sudah like sebelumnya

  const updated = list.map(item => item.id === id ? { ...item, likes: (item.likes || 0) + 1 } : item);
  try {
    localStorage.setItem(TESTIMONIALS_KEY, JSON.stringify(updated));
    likedList.push(id);
    localStorage.setItem(likedKey, JSON.stringify(likedList));
  } catch (_) {}
  return true;
}

// Hapus ulasan (khusus owner saat login)
function apiDeleteReview(id) {
  const list = apiGetReviews();
  const updated = list.filter(item => item.id !== id);
  try {
    localStorage.setItem(TESTIMONIALS_KEY, JSON.stringify(updated));
  } catch (_) {}
  return updated;
}

// Ambil ulasan KHUSUS satu produk (berdasarkan nama produk atau ID produk)
function apiGetReviewsByProduct(productName, productId = null) {
  const all = apiGetReviews();
  const norm = (productName || '').toLowerCase().trim();
  return all.filter(r => {
    if (productId && r.productId && String(r.productId) === String(productId)) return true;
    if (norm && r.productName && r.productName.toLowerCase().trim() === norm) return true;
    return false;
  });
}

// Hitung statistik rating khusus satu produk
function getProductRatingStats(productName, productId = null) {
  const reviews = apiGetReviewsByProduct(productName, productId);
  const count = reviews.length;
  if (count === 0) {
    return { count: 0, avg: '5.0', reviews: [] };
  }
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  const avg = (sum / count).toFixed(1);
  return { count, avg, reviews };
}

