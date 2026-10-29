// ==============================================================
// LOGIKA APLIKASI UTAMA (ROUTING, UI, INTERAKSI)
// ==============================================================

const $ = (selector, root = document) => root.querySelector(selector);
const rupiah = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');
const esc = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ----------------- NAVBAR & SECRET ACCESS -----------------
let logoClickCount = 0;
let logoClickTimer = null;

function setupSecretLogoAccess() {
  const brand = $('.brand');
  if (!brand) return;
  brand.addEventListener('click', (e) => {
    logoClickCount++;
    clearTimeout(logoClickTimer);
    logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1800);

    // Jika logo diklik 3 kali dalam 1.8 detik -> buka halaman login tersembunyi
    if (logoClickCount >= 3) {
      logoClickCount = 0;
      location.hash = '#/login';
    }
  });
}

async function renderNav() {
  const session = await apiGetSession();
  const nav = $('#nav');
  if (!nav) return;

  if (session) {
    // Menu hanya tampil saat Owner sudah login
    nav.innerHTML = `
      <a class="btn sm" href="#/">Lihat Toko</a>
      <a class="btn sm primary" href="#/admin">Kelola Produk</a>
      <button class="btn sm danger" id="logoutBtn">Keluar</button>
    `;
    const lo = $('#logoutBtn');
    if (lo) {
      lo.onclick = async () => {
        await apiLogout();
        location.hash = '#/';
        toast('Anda telah keluar');
        renderNav();
        route();
      };
    }
  } else {
    // UNTUK PENGUNJUNG UMUM: TIDAK ADA TOMBOL LOGIN SAMA SEKALI
    nav.innerHTML = '';
  }
}

// ----------------- ROUTER -----------------
async function route() {
  const hash = location.hash || '#/';
  const session = await apiGetSession();

  if (hash === '#/admin') {
    if (!session) {
      location.hash = '#/login';
      return;
    }
    return viewAdmin();
  }

  if (hash === '#/login') {
    if (session) {
      location.hash = '#/admin';
      return;
    }
    return viewLogin();
  }

  // Default: Halaman Publik (Toko)
  viewGuest();
}

// ----------------- GUEST VIEW (KATALOG PRODUK) -----------------
let activeCat = '';
async function viewGuest() {
  const app = $('#app');
  app.innerHTML = `
    <section class="hero">
      <h1>Koleksi Desain Kami</h1>
      <p>Pilih kategori atau sentuh produk untuk melihat detail foto lainnya.</p>
      <input class="search" id="q" type="search" placeholder="Cari nama desain atau produk..." aria-label="Cari desain">
      <div class="chips" id="chips"></div>
    </section>
    ${!isSupabaseConfigured() ? `
      <div class="setup-alert">
        <h3>💡 Info Pemilik Toko</h3>
        <p>Supabase belum dihubungkan di <code>js/config.js</code>. Saat ini katalog menampilkan data demo lokal.</p>
      </div>` : ''}
    <section class="grid" id="grid">
      <div class="empty">Memuat produk...</div>
    </section>
  `;

  let products = [];
  let categories = [];

  try {
    [products, categories] = await Promise.all([
      apiGetProducts(),
      apiGetCategories()
    ]);
  } catch (err) {
    console.error(err);
    toast('Gagal memuat produk');
  }

  const activeProducts = products.filter(p => p.active);
  // HANYA kategori yang memiliki produk aktif yang akan dimunculkan ke pengunjung
  const cats = [...new Set(activeProducts.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  if (activeCat && !cats.includes(activeCat)) activeCat = '';

  const chipsContainer = $('#chips');
  const drawChips = () => {
    // Jika tidak ada produk atau hanya ada 1 kategori, tidak perlu tampil tombol filter berlebihan
    if (cats.length <= 1) {
      chipsContainer.innerHTML = '';
      return;
    }
    chipsContainer.innerHTML = ['', ...cats].map(c =>
      `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === activeCat}">${c ? esc(c) : 'Semua'}</button>`
    ).join('');
  };

  const drawGrid = () => {
    const q = ($('#q')?.value || '').trim().toLowerCase();
    const list = activeProducts.filter(p => {
      const matchCat = !activeCat || p.category === activeCat;
      const matchQuery = (p.name + ' ' + (p.desc || '')).toLowerCase().includes(q);
      return matchCat && matchQuery;
    });

    const grid = $('#grid');
    if (!list.length) {
      grid.innerHTML = `<div class="empty">${q || activeCat ? 'Tidak ada produk yang cocok.' : 'Belum ada produk yang ditampilkan.'}</div>`;
      return;
    }

    grid.innerHTML = list.map(p => {
      const imgs = [p.image, p.image2, p.image3].filter(Boolean);
      const multi = imgs.length > 1;
      const descText = (p.desc || '').trim();
      return `
        <article class="card" data-id="${p.id}">
          <div class="thumb ${multi ? 'multi' : ''}" ${multi ? 'tabindex="0" role="button" aria-label="Ganti foto ' + esc(p.name) + '"' : ''}>
            ${imgs.length ? imgs.map((s, i) => `<img class="${i === 0 ? 'on' : ''}" src="${esc(s)}" alt="${esc(p.name)} foto ${i + 1}">`).join('') : esc(p.name.charAt(0).toUpperCase())}
            ${multi ? `<span class="dots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</span>` : ''}
          </div>
          <div class="body">
            ${p.category ? `<span class="cat">${esc(p.category)}</span>` : ''}
            <h3 class="card-title" title="${esc(p.name)}">${esc(p.name)}</h3>
            <div class="price">${rupiah(p.price)}</div>
            ${descText ? `
              <p class="desc-snippet">${esc(descText)}</p>
              <button type="button" class="btn-readmore" data-id="${p.id}">Baca selengkapnya...</button>
            ` : ''}
            <button type="button" class="btn-order" data-id="${p.id}" aria-label="Pesan ${esc(p.name)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              Order
            </button>
          </div>
        </article>
      `;
    }).join('');
  };

  // Event Listeners Filter
  $('#q').oninput = drawGrid;
  chipsContainer.onclick = e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    activeCat = b.dataset.c;
    drawChips();
    drawGrid();
  };

  // Interaksi Foto Carousel (Hover di PC / Tap di HP)
  const showImage = (t, i) => {
    const im = t.querySelectorAll('img');
    const dt = t.querySelectorAll('.dots i');
    if (!im.length) return;
    t._i = (i + im.length) % im.length;
    im.forEach((x, k) => x.classList.toggle('on', k === t._i));
    dt.forEach((x, k) => x.classList.toggle('on', k === t._i));
  };
  const stopCycle = t => { clearInterval(t._timer); t._timer = null; };
  const nextImage = t => { stopCycle(t); showImage(t, (t._i || 0) + 1); };

  const grid = $('#grid');
  grid.onmouseover = e => {
    const t = e.target.closest('.multi');
    if (!t || t._hov || !matchMedia('(hover:hover)').matches) return;
    t._hov = true;
    showImage(t, 1);
    t._timer = setInterval(() => showImage(t, t._i + 1), 1200);
  };
  grid.onmouseout = e => {
    const t = e.target.closest('.multi');
    if (!t || t.contains(e.relatedTarget)) return;
    t._hov = false;
    stopCycle(t);
    showImage(t, 0);
  };
  grid.onclick = e => {
    // Klik tombol "Baca selengkapnya" -> Buka modal detail
    const readMoreBtn = e.target.closest('.btn-readmore');
    if (readMoreBtn) {
      e.stopPropagation();
      const p = activeProducts.find(item => String(item.id) === String(readMoreBtn.dataset.id));
      if (p) openDetailModal(p);
      return;
    }

    // Klik tombol "Order" -> Buka modal pilihan admin
    const orderBtn = e.target.closest('.btn-order');
    if (orderBtn) {
      e.stopPropagation();
      const p = activeProducts.find(item => String(item.id) === String(orderBtn.dataset.id));
      if (p) openOrderModal(p);
      return;
    }

    // Klik judul kartu -> Buka modal detail
    const titleClick = e.target.closest('.card-title');
    if (titleClick) {
      const card = titleClick.closest('.card');
      if (card) {
        const p = activeProducts.find(item => String(item.id) === String(card.dataset.id));
        if (p) openDetailModal(p);
      }
      return;
    }

    // Klik foto multi -> Ganti foto berikutnya
    const t = e.target.closest('.multi');
    if (t) nextImage(t);
  };
  grid.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const t = e.target.closest('.multi');
      if (t) { e.preventDefault(); nextImage(t); }
    }
  };

  drawChips();
  drawGrid();
}

// ----------------- MODAL POPUP (DETAIL & ORDER) -----------------
// Modal Detail Produk Lengkap (Baca Selengkapnya)
function openDetailModal(p) {
  const modalContainer = $('#modalContainer');
  if (!modalContainer) return;

  const imgs = [p.image, p.image2, p.image3].filter(Boolean);
  const multi = imgs.length > 1;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="detailModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
      <div class="modal-card">
        <button type="button" class="modal-close" id="closeDetailModal" aria-label="Tutup detail">&times;</button>
        <div class="modal-body">
          <div class="modal-thumb ${multi ? 'multi' : ''}" id="modalThumb" ${multi ? 'tabindex="0" role="button" title="Sentuh untuk ganti foto"' : ''}>
            ${imgs.length ? imgs.map((s, i) => `<img class="${i === 0 ? 'on' : ''}" src="${esc(s)}" alt="${esc(p.name)} foto ${i + 1}">`).join('') : esc(p.name.charAt(0).toUpperCase())}
            ${multi ? `<span class="dots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</span>` : ''}
          </div>
          ${p.category ? `<span class="cat">${esc(p.category)}</span>` : ''}
          <h2 id="detailTitle" style="margin: 6px 0 8px; font-size: 1.25rem; color: var(--ink); line-height: 1.3;">${esc(p.name)}</h2>
          <div class="price" style="font-size: 1.25rem; font-weight: 700; color: var(--accent); margin-bottom: 12px;">${rupiah(p.price)}</div>
          
          <div style="font-weight: 600; font-size: 0.88rem; color: var(--muted); margin-bottom: 6px;">Informasi &amp; Deskripsi Lengkap:</div>
          <div class="modal-desc">${esc(p.desc || 'Tidak ada keterangan tambahan.')}</div>
          
          <button type="button" class="btn primary" id="btnModalOrder" style="width: 100%; padding: 12px; font-size: 1rem; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Order Sekarang
          </button>
        </div>
      </div>
    </div>
  `;

  const backdrop = $('#detailModalBackdrop');
  requestAnimationFrame(() => backdrop.classList.add('show'));

  const closeModal = () => {
    backdrop.classList.remove('show');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  $('#closeDetailModal').onclick = closeModal;
  backdrop.onclick = e => {
    if (e.target === backdrop) closeModal();
  };

  if (multi) {
    const thumb = $('#modalThumb');
    let idx = 0;
    const ims = thumb.querySelectorAll('img');
    const dts = thumb.querySelectorAll('.dots i');
    thumb.onclick = () => {
      idx = (idx + 1) % ims.length;
      ims.forEach((img, i) => img.classList.toggle('on', i === idx));
      dts.forEach((dot, i) => dot.classList.toggle('on', i === idx));
    };
  }

  $('#btnModalOrder').onclick = () => {
    closeModal();
    openOrderModal(p);
  };
}

// Modal Pilih Admin Order WhatsApp
function openOrderModal(p) {
  const modalContainer = $('#modalContainer');
  if (!modalContainer) return;

  const contacts = (typeof ADMIN_CONTACTS !== 'undefined' && Array.isArray(ADMIN_CONTACTS) && ADMIN_CONTACTS.length)
    ? ADMIN_CONTACTS
    : [
        { name: 'Admin 1', phone: '628212769293' },
        { name: 'Admin 2', phone: '6285287140773' },
        { name: 'Admin 3', phone: '6282321982264' }
      ];

  const defaultMsg = typeof ORDER_MESSAGE !== 'undefined' ? ORDER_MESSAGE : 'mauu orderr donng kaa';

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="orderModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="orderTitle">
      <div class="modal-card modal-order">
        <button type="button" class="modal-close" id="closeOrderModal" aria-label="Tutup pilihan admin">&times;</button>
        <div class="modal-body">
          <div style="text-align: center; margin-bottom: 14px;">
            <div style="font-size: 2rem; margin-bottom: 4px;">💬</div>
            <h2 id="orderTitle" style="margin: 0 0 6px; font-size: 1.2rem; color: var(--ink);">Pilih Admin Pemesanan</h2>
            <p style="margin: 0; font-size: 0.88rem; color: var(--muted);">
              Mau order <strong>${esc(p.name)}</strong> (${rupiah(p.price)})? Silakan pilih salah satu admin di bawah:
            </p>
          </div>

          <div class="admin-list">
            ${contacts.map((admin) => `
              <button type="button" class="btn-admin" data-phone="${esc(admin.phone)}" data-name="${esc(admin.name)}">
                <div class="admin-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm.01 18.06c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.13.82.84-3.05-.2-.31c-.83-1.33-1.27-2.88-1.27-4.46 0-4.48 3.65-8.12 8.13-8.12 2.17 0 4.21.85 5.74 2.38 1.54 1.54 2.38 3.57 2.38 5.74 0 4.49-3.65 8.12-8.13 8.12zm4.45-6.09c-.24-.12-1.44-.71-1.66-.79-.23-.08-.39-.12-.56.12-.17.24-.64.79-.79.95-.14.16-.29.18-.53.06-.24-.12-1.02-.38-1.95-1.21-.72-.64-1.21-1.44-1.35-1.68-.14-.24-.02-.37.1-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.35.99 2.51c.12.16 1.72 2.62 4.16 3.67.58.25 1.03.4 1.39.51.58.19 1.12.16 1.54.1.47-.07 1.44-.59 1.64-1.15.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28z"/>
                  </svg>
                </div>
                <div class="admin-info">
                  <span class="admin-name">${esc(admin.name)}</span>
                  <span class="admin-status">🟢 Chat via WhatsApp</span>
                </div>
                <span class="admin-arrow">&rarr;</span>
              </button>
            `).join('')}
          </div>

          <div style="font-size: 0.78rem; text-align: center; color: var(--muted); margin-top: 10px;">
            Pesan otomatis: <em>&ldquo;${esc(defaultMsg)}&rdquo;</em>
          </div>
        </div>
      </div>
    </div>
  `;

  const backdrop = $('#orderModalBackdrop');
  requestAnimationFrame(() => backdrop.classList.add('show'));

  const closeModal = () => {
    backdrop.classList.remove('show');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  $('#closeOrderModal').onclick = closeModal;
  backdrop.onclick = e => {
    if (e.target === backdrop) closeModal();
  };

  backdrop.querySelectorAll('.btn-admin').forEach(btn => {
    btn.onclick = () => {
      const rawPhone = btn.dataset.phone || '';
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      const text = `${defaultMsg}\n\n*Nama Produk:* ${p.name}\n*Harga:* ${rupiah(p.price)}`;
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
      closeModal();
    };
  });
}

// Tutup modal jika tombol Escape ditekan
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const backdrop = document.querySelector('.modal-backdrop.show');
    if (backdrop) {
      backdrop.classList.remove('show');
      setTimeout(() => {
        const mc = $('#modalContainer');
        if (mc) mc.innerHTML = '';
      }, 250);
    }
  }
});

// ----------------- LOGIN VIEW (TERSEMBUNYI UNTUK OWNER) -----------------
function viewLogin() {
  $('#app').innerHTML = `
    <form class="panel login" id="loginForm" autocomplete="off">
      <h1>Masuk Owner</h1>
      <p class="hint" style="margin-bottom:16px">Gunakan email & kata sandi akun Supabase Anda.</p>
      
      <label for="uEmail">Email</label>
      <input type="email" id="uEmail" required placeholder="owner@gmail.com">
      
      <label for="uPass">Password</label>
      <input type="password" id="uPass" required placeholder="••••••••">
      
      <div class="err" id="loginErr" role="alert"></div>
      <div class="actions">
        <button class="btn primary" type="submit" id="submitLogin">Masuk</button>
        <a class="btn" href="#/">Kembali ke Toko</a>
      </div>
    </form>
  `;

  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('#uEmail').value.trim();
    const pass = $('#uPass').value;
    const err = $('#loginErr');
    const btn = $('#submitLogin');

    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Memeriksa...';

    try {
      await apiLogin(email, pass);
      toast('Berhasil masuk sebagai Owner');
      await renderNav();
      location.hash = '#/admin';
    } catch (error) {
      err.textContent = error.message || 'Email atau password salah.';
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  };
}

// ----------------- ADMIN VIEW (KELOLA PRODUK & KATEGORI) -----------------
let editId = null;
let img1Url = '', img2Url = '', img3Url = '';
let img1File = null, img2File = null, img3File = null;

const renderPv = (src, defaultTxt) => src ? `<img src="${esc(src)}" alt="">` : defaultTxt;

async function viewAdmin() {
  let products = [];
  let categories = [];

  try {
    [products, categories] = await Promise.all([
      apiGetProducts(),
      apiGetCategories()
    ]);
  } catch (err) {
    console.error(err);
    toast('Gagal memuat data');
  }

  const p = products.find(x => x.id === editId) || {
    name: '', category: '', price: '', desc: '', image: '', image2: '', image3: ''
  };

  img1Url = p.image || '';
  img2Url = p.image2 || '';
  img3Url = p.image3 || '';
  img1File = null; img2File = null; img3File = null;

  const catOptionsHtml = categories.map(c =>
    `<option value="${esc(c)}" ${c === p.category ? 'selected' : ''}>${esc(c)}</option>`
  ).join('');

  const catChipsHtml = categories.length ? categories.map(c => {
    const count = products.filter(x => x.category === c).length;
    return `
      <span class="chip" style="display:inline-flex;gap:8px;align-items:center">
        <span>${esc(c)} <small style="opacity:0.7">(${count})</small></span>
        <button type="button" class="btn sm danger" data-del-cat="${esc(c)}" aria-label="Hapus kategori ${esc(c)}" style="padding:2px 8px;font-size:0.8rem;line-height:1">×</button>
      </span>
    `;
  }).join('') : '<span class="hint">Belum ada kategori. Silakan tambahkan.</span>';

  $('#app').innerHTML = `
    <!-- Kelola Kategori -->
    <section class="panel">
      <h2>Kategori Produk</h2>
      <label for="nc">Tambah Kategori Baru</label>
      <div class="up">
        <input type="text" id="nc" placeholder="Contoh: Frame foto, Buket bunga, Hampers">
        <button class="btn primary" type="button" id="addcat">Tambah</button>
      </div>
      <div class="chips" id="catlist" style="margin-top:14px">${catChipsHtml}</div>
    </section>

    <!-- Formulir Tambah / Edit Produk -->
    <form class="panel" id="productForm">
      <h2>${editId ? 'Ubah Produk' : 'Tambah Produk Baru'}</h2>
      <div class="row">
        <div>
          <label for="pName">Nama Produk / Desain</label>
          <input type="text" id="pName" required value="${esc(p.name)}" placeholder="Nama produk">
        </div>
        <div>
          <label for="pCat">Kategori</label>
          <select id="pCat" required>
            <option value="" disabled ${p.category ? '' : 'selected'}>Pilih kategori</option>
            ${catOptionsHtml}
          </select>
        </div>
      </div>

      <div class="row">
        <div>
          <label for="pPrice">Harga (Rp)</label>
          <input type="number" id="pPrice" min="0" step="100" required value="${esc(p.price)}" placeholder="25000">
        </div>
        <div></div>
      </div>

      <label for="pDesc">Deskripsi Produk</label>
      <textarea id="pDesc" placeholder="Keterangan ukuran, bahan, atau cara pemesanan">${esc(p.desc)}</textarea>

      <!-- Upload Foto 1 -->
      <div class="row" style="margin-top:10px">
        <div>
          <label for="i1">Foto Depan (Utama)</label>
          <div class="up">
            <div class="pv" id="pv1">${renderPv(img1Url, 'Kosong')}</div>
            <input type="file" id="i1" accept="image/*">
          </div>
        </div>
        <div>
          <label for="i2">Foto Kedua (Opsional)</label>
          <div class="up">
            <div class="pv" id="pv2">${renderPv(img2Url, 'Kosong')}</div>
            <input type="file" id="i2" accept="image/*">
          </div>
          ${img2Url ? '<button class="btn sm danger" type="button" id="rm2" style="margin-top:6px">Hapus Foto 2</button>' : ''}
        </div>
      </div>

      <!-- Upload Foto 3 -->
      <div class="row">
        <div>
          <label for="i3">Foto Ketiga (Opsional)</label>
          <div class="up">
            <div class="pv" id="pv3">${renderPv(img3Url, 'Kosong')}</div>
            <input type="file" id="i3" accept="image/*">
          </div>
          ${img3Url ? '<button class="btn sm danger" type="button" id="rm3" style="margin-top:6px">Hapus Foto 3</button>' : ''}
        </div>
        <div></div>
      </div>
      <div class="hint">Foto akan otomatis dikompresi agar loading cepat di HP pelanggan.</div>

      <div class="actions">
        <button class="btn primary" type="submit" id="saveBtn">${editId ? 'Simpan Perubahan' : 'Unggah Produk'}</button>
        ${editId ? '<button class="btn" type="button" id="cancelEdit">Batal</button>' : ''}
      </div>
    </form>

    <!-- Daftar Produk -->
    <section class="panel">
      <h2>Daftar Produk (${products.length})</h2>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Harga</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${products.length ? products.map(x => `
              <tr class="${x.active ? '' : 'disabled'}">
                <td>
                  <div class="mini">
                    <span>${renderPv(x.image, '–')}</span>
                    ${x.image2 ? `<span>${renderPv(x.image2)}</span>` : ''}
                    ${x.image3 ? `<span>${renderPv(x.image3)}</span>` : ''}
                  </div>
                </td>
                <td><strong>${esc(x.name)}</strong></td>
                <td><span class="cat">${esc(x.category)}</span></td>
                <td>${rupiah(x.price)}</td>
                <td><span class="tag ${x.active ? '' : 'off'}">${x.active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td>
                  <div class="cells">
                    <button class="btn sm" data-action="toggle" data-id="${x.id}">${x.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    <button class="btn sm" data-action="edit" data-id="${x.id}">Ubah</button>
                    <button class="btn sm danger" data-action="del" data-id="${x.id}">Hapus</button>
                  </div>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px">Belum ada produk.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;

  // Listener Kategori
  const addCat = async () => {
    const val = $('#nc').value.trim();
    if (!val) return;
    try {
      await apiAddCategory(val);
      toast('Kategori ditambahkan');
      viewAdmin();
    } catch (e) {
      toast(e.message || 'Gagal menambah kategori');
    }
  };
  $('#addcat').onclick = addCat;
  $('#nc').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } };

  $('#catlist').onclick = async e => {
    const btn = e.target.closest('[data-del-cat]');
    if (!btn) return;
    const catName = btn.dataset.delCat;
    const count = products.filter(x => x.category === catName).length;

    let confirmMsg = `Hapus kategori "${catName}"?`;
    if (count > 0) {
      confirmMsg = `Kategori "${catName}" saat ini digunakan oleh ${count} produk.\nTetap ingin menghapus kategori ini?`;
    }

    if (confirm(confirmMsg)) {
      btn.disabled = true;
      try {
        await apiDeleteCategory(catName);
        toast(`Kategori "${catName}" berhasil dihapus`);
        viewAdmin();
      } catch (err) {
        console.error(err);
        toast(err.message || 'Gagal menghapus kategori');
        btn.disabled = false;
      }
    }
  };

  // Preview Foto saat dipilih
  const setupFilePick = (inputId, pvId, onPick) => {
    $(inputId).onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      onPick(file);
      const url = URL.createObjectURL(file);
      $(pvId).innerHTML = `<img src="${url}" alt="Preview">`;
    };
  };

  setupFilePick('#i1', '#pv1', f => img1File = f);
  setupFilePick('#i2', '#pv2', f => img2File = f);
  setupFilePick('#i3', '#pv3', f => img3File = f);

  if ($('#rm2')) {
    $('#rm2').onclick = () => { img2Url = ''; img2File = null; $('#pv2').textContent = 'Kosong'; $('#i2').value = ''; $('#rm2').remove(); };
  }
  if ($('#rm3')) {
    $('#rm3').onclick = () => { img3Url = ''; img3File = null; $('#pv3').textContent = 'Kosong'; $('#i3').value = ''; $('#rm3').remove(); };
  }
  if ($('#cancelEdit')) {
    $('#cancelEdit').onclick = () => { editId = null; viewAdmin(); };
  }

  // Submit Simpan / Tambah Produk
  $('#productForm').onsubmit = async e => {
    e.preventDefault();
    const saveBtn = $('#saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan & mengunggah foto...';

    try {
      // Upload foto jika ada file baru yang dipilih
      if (img1File) img1Url = await apiUploadImage(img1File);
      if (img2File) img2Url = await apiUploadImage(img2File);
      if (img3File) img3Url = await apiUploadImage(img3File);

      const productData = {
        name: $('#pName').value.trim(),
        category: $('#pCat').value,
        price: Number($('#pPrice').value),
        desc: $('#pDesc').value.trim(),
        image: img1Url,
        image2: img2Url,
        image3: img3Url
      };

      await apiSaveProduct(productData, editId);
      toast(editId ? 'Produk berhasil diubah' : 'Produk berhasil ditambahkan');
      editId = null;
      viewAdmin();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Gagal menyimpan produk');
      saveBtn.disabled = false;
      saveBtn.textContent = editId ? 'Simpan Perubahan' : 'Unggah Produk';
    }
  };

  // Tabel Action (Toggle, Edit, Delete)
  $('tbody').onclick = async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const item = products.find(x => String(x.id) === String(id));
    if (!item) return;

    if (action === 'toggle') {
      try {
        await apiToggleProduct(item.id, !item.active);
        toast(item.active ? 'Produk dinonaktifkan' : 'Produk diaktifkan');
        viewAdmin();
      } catch (err) {
        toast('Gagal mengubah status');
      }
    } else if (action === 'edit') {
      editId = item.id;
      viewAdmin();
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else if (action === 'del') {
      if (confirm(`Yakin ingin menghapus produk "${item.name}"?`)) {
        try {
          await apiDeleteProduct(item.id);
          toast('Produk dihapus');
          viewAdmin();
        } catch (err) {
          toast('Gagal menghapus produk');
        }
      }
    }
  };
}

// ----------------- INISIALISASI -----------------
window.addEventListener('hashchange', () => {
  renderNav();
  route();
});

document.addEventListener('DOMContentLoaded', () => {
  setupSecretLogoAccess();
  renderNav();
  route();
});
