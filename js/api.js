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
// TESTIMONI & ULASAN PRODUK (SUPABASE DATABASE)
// ==============================================================

// Bersihkan cache localStorage lama dari browser
try {
  localStorage.removeItem('klk_testimonials_v1');
  localStorage.removeItem('klk_testimonials_v2');
  localStorage.removeItem('klk_testimonials_v3');
} catch (_) {}

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

// Helper kompresi foto ulasan ke Blob sebelum upload ke Supabase Storage
function compressImageToBase64(file, maxDimension = 680, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > maxDimension) { height = Math.round(height * maxDimension / width); width = maxDimension; }
        } else {
          if (height > maxDimension) { width = Math.round(width * maxDimension / height); height = maxDimension; }
        }
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        c.getContext('2d').drawImage(img, 0, 0, width, height);
        c.toBlob(blob => blob ? resolve(blob) : reject(new Error('Gagal kompres foto')), 'image/jpeg', quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Upload foto ulasan ke Supabase Storage, return public URL
async function apiUploadReviewPhoto(file) {
  const blob = await compressImageToBase64(file);

  if (!supabaseClient) {
    // Fallback DataURL jika Supabase belum terhubung
    return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  }

  const filePath = `reviews/rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
  const { error: upErr } = await supabaseClient.storage
    .from('product-images')
    .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabaseClient.storage
    .from('product-images').getPublicUrl(filePath);
  return publicUrl;
}

// Ambil SEMUA ulasan dari Supabase
async function apiGetReviews() {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('reviews').select('*').order('created_at', { ascending: false });
  if (error) { console.warn('Gagal memuat ulasan:', error); return []; }
  return (data || []).map(r => ({
    ...r,
    productName: r.product_name || '',
    productId: r.product_id || null,
    photos: Array.isArray(r.photos) ? r.photos : []
  }));
}

// Simpan ulasan baru pembeli ke Supabase
async function apiSaveReview(review) {
  const payload = {
    name: review.name || 'Pembeli',
    product_name: review.productName || review.product_name || '',
    product_id: review.productId || review.product_id || null,
    rating: Number(review.rating) || 5,
    comment: review.comment || '',
    photos: review.photos || [],
    likes: 0,
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  };

  if (!supabaseClient) throw new Error('Supabase belum terhubung, ulasan tidak dapat disimpan.');

  const { data, error } = await supabaseClient
    .from('reviews').insert([payload]).select().single();
  if (error) throw error;
  return { ...data, productName: data.product_name, productId: data.product_id, photos: data.photos || [] };
}

// Tambah like "Membantu" pada ulasan (anti-double-like via localStorage)
async function apiLikeReview(id) {
  const likedKey = 'klk_liked_reviews_v2';
  let likedList = [];
  try { likedList = JSON.parse(localStorage.getItem(likedKey) || '[]'); } catch (_) {}
  if (likedList.includes(id)) return false;

  if (supabaseClient) {
    const { data: cur } = await supabaseClient.from('reviews').select('likes').eq('id', id).single();
    await supabaseClient.from('reviews').update({ likes: (cur?.likes || 0) + 1 }).eq('id', id);
  }

  try { likedList.push(id); localStorage.setItem(likedKey, JSON.stringify(likedList)); } catch (_) {}
  return true;
}

// Hapus ulasan (khusus owner yang login)
async function apiDeleteReview(id) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from('reviews').delete().eq('id', id);
  if (error) throw error;
}

// Ambil ulasan khusus satu produk dari Supabase
async function apiGetReviewsByProduct(productName, productId = null) {
  if (!supabaseClient) return [];
  const norm = (productName || '').toLowerCase().trim();
  let query = supabaseClient.from('reviews').select('*').order('created_at', { ascending: false });
  if (productId) {
    query = query.or(`product_id.eq.${productId},product_name.ilike.${norm}`);
  } else if (norm) {
    query = query.ilike('product_name', norm);
  }
  const { data, error } = await query;
  if (error) { console.warn(error); return []; }
  return (data || []).map(r => ({
    ...r, productName: r.product_name, productId: r.product_id,
    photos: Array.isArray(r.photos) ? r.photos : []
  }));
}

// Hitung statistik rating untuk satu produk
async function getProductRatingStats(productName, productId = null) {
  const reviews = await apiGetReviewsByProduct(productName, productId);
  const count = reviews.length;
  if (count === 0) return { count: 0, avg: '5.0', reviews: [] };
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  return { count, avg: (sum / count).toFixed(1), reviews };
}


// Balas ulasan pembeli (khusus admin/owner yang login)
async function apiReplyReview(id, replyText) {
  if (!supabaseClient) throw new Error('Supabase belum terhubung');
  const cleanText = (replyText || '').trim();
  const payload = {
    admin_reply: cleanText || null,
    admin_reply_at: cleanText ? new Date().toISOString() : null
  };
  const { data, error } = await supabaseClient
    .from('reviews')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}