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

// ----------------- PRODUK -----------------
async function apiGetProducts() {
  if (!supabaseClient) {
    try {
      const cached = localStorage.getItem('klk_mock_products');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return MOCK_PRODUCTS;
  }
  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
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
  if (!supabaseClient) {
    let list = await apiGetCategories();
    if (!list.includes(name)) {
      list.push(name);
      localStorage.setItem('klk_mock_cats', JSON.stringify(list));
    }
    return;
  }
  const { error } = await supabaseClient
    .from('categories')
    .insert([{ name }]);
  if (error) throw error;
}

async function apiDeleteCategory(name) {
  if (!supabaseClient) {
    let list = await apiGetCategories();
    list = list.filter(c => c !== name);
    localStorage.setItem('klk_mock_cats', JSON.stringify(list));
    return;
  }
  const { error } = await supabaseClient
    .from('categories')
    .delete()
    .eq('name', name);
  if (error) throw error;
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
