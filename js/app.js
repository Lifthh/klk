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

  const hash = location.hash || '#/';
  const isKatalog = hash === '#/' || hash === '';
  const isUcapan = hash.startsWith('#/ucapan');
  const isUlasan = hash.startsWith('#/ulasan') || hash.startsWith('#/testimoni');
  const isAdminKeychain = hash === '#/admin' || hash.startsWith('#/admin-keychain');
  const isAdminUcapan = hash.startsWith('#/admin-ucapan');
  const isAdmin = isAdminKeychain || isAdminUcapan;

  if (session) {
    // Menu saat Owner sudah login: Dropdown Kelola Produk (Keychain & Ucapan Digital)
    nav.innerHTML = `
      <a class="btn sm ${isKatalog ? 'primary' : ''}" href="#/">Katalog</a>
      <a class="btn sm ${isUcapan ? 'primary' : ''}" href="#/ucapan">Ucapan Digital</a>
      <a class="btn sm ${isUlasan ? 'primary' : ''}" href="#/ulasan" id="navUlasanBtn">Ulasan</a>
      
      <div class="nav-dropdown" id="adminDropdown">
        <button type="button" class="btn sm ${isAdmin ? 'primary' : ''} dropdown-toggle" id="btnAdminDropdown" aria-haspopup="true" aria-expanded="false">
          Kelola Produk <span class="caret">▾</span>
        </button>
        <div class="dropdown-menu" id="adminDropdownMenu">
          <a class="dropdown-item ${isAdminKeychain ? 'active' : ''}" href="#/admin" id="dropKeychain">
            🔑 Keychain
          </a>
          <a class="dropdown-item ${isAdminUcapan ? 'active' : ''}" href="#/admin-ucapan" id="dropUcapan">
            💌 Ucapan Digital
          </a>
        </div>
      </div>

      <button class="btn sm danger" id="logoutBtn">Keluar</button>
    `;

    const drop = $('#adminDropdown');
    const dropBtn = $('#btnAdminDropdown');
    if (drop && dropBtn) {
      dropBtn.onclick = (e) => {
        e.stopPropagation();
        drop.classList.toggle('open');
      };
    }

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
    // UNTUK PENGUNJUNG UMUM: Navigasi Mudah ke Katalog, Ucapan Digital, & Ulasan
    nav.innerHTML = `
      <a class="btn sm ${isKatalog ? 'primary' : ''}" href="#/">Katalog</a>
      <a class="btn sm ${isUcapan ? 'primary' : ''}" href="#/ucapan">Ucapan Digital</a>
      <a class="btn sm ${isUlasan ? 'primary' : ''}" href="#/ulasan" id="navUlasanBtn">Ulasan</a>
    `;
  }

  const ulasanBtn = $('#navUlasanBtn');
  if (ulasanBtn) {
    ulasanBtn.onclick = () => {
      activeProductTestiFilter = '';
      if (location.hash === '#/ulasan') {
        viewTestimoni();
      }
    };
  }
}

// ----------------- ROUTER -----------------
async function route() {
  const hash = location.hash || '#/';
  const session = await apiGetSession();

  if (hash === '#/admin' || hash.startsWith('#/admin-keychain')) {
    if (!session) {
      location.hash = '#/login';
      return;
    }
    return viewAdmin('keychain');
  }

  if (hash.startsWith('#/admin-ucapan')) {
    if (!session) {
      location.hash = '#/login';
      return;
    }
    return viewAdmin('ucapan');
  }

  if (hash === '#/login') {
    if (session) {
      location.hash = '#/admin';
      return;
    }
    return viewLogin();
  }

  if (hash.startsWith('#/ulasan') || hash.startsWith('#/testimoni')) {
    return viewTestimoni();
  }

  if (hash.startsWith('#/ucapan')) {
    return viewUcapanDigital();
  }

  // Default: Halaman Publik (Toko)
  viewGuest();
}

// ----------------- GUEST VIEW (KATALOG PRODUK) -----------------
let activeCat = '';
async function viewGuest() {
  const app = $('#app');
  const allReviews = apiGetReviews();
  const revCount = allReviews.length;
  const revAvg = revCount > 0 ? (allReviews.reduce((a, b) => a + (Number(b.rating) || 5), 0) / revCount).toFixed(1) : null;

  app.innerHTML = `
    <section class="hero">
      <h1>Koleksi Desain Kami</h1>
      <p>Pilih kategori atau sentuh produk untuk melihat detail foto lainnya.</p>
      
      <a href="#/ulasan" class="hero-rating-badge" title="Lihat semua ulasan pembeli">
        ${revCount > 0 ? `
          <span class="stars">${renderStars(Math.round(Number(revAvg)))}</span>
          <strong>${revAvg} / 5.0</strong>
          <span class="sep">•</span>
          <span>Lihat ${revCount} Ulasan &amp; Foto Pembeli &rarr;</span>
        ` : `
          <span class="star-gold">★</span>
          <span>Lihat &amp; Tulis Ulasan Pembeli &rarr;</span>
        `}
      </a>

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

  const activeProducts = products.filter(p => p.active && isKeychainProduct(p));
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
      const pStats = getProductRatingStats(p.name, p.id);
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
            <div class="card-rating" data-id="${p.id}" role="button" tabindex="0" title="Lihat ${pStats.count} ulasan untuk ${esc(p.name)}">
              ${pStats.count > 0 ? `<span class="star-gold">★</span> <strong>${pStats.avg}</strong> <span class="card-rating-count">(${pStats.count} ulasan)</span>` : `<span class="star-gray">★</span> <span class="card-rating-count">Belum ada ulasan</span>`}
            </div>
            ${descText ? `
              <p class="desc-snippet">${esc(descText)}</p>
              <button type="button" class="btn-readmore" data-id="${p.id}">Baca selengkapnya...</button>
            ` : ''}
            <div class="card-actions">
              <button type="button" class="btn-order" data-id="${p.id}" aria-label="Pesan ${esc(p.name)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                Order
              </button>
              <button type="button" class="btn-view-reviews" data-id="${p.id}" aria-label="Lihat ulasan untuk ${esc(p.name)}" title="Lihat Ulasan Produk Ini">
                📋
              </button>
              <button type="button" class="btn-rate-quick" data-id="${p.id}" aria-label="Beri penilaian untuk ${esc(p.name)}" title="Beri Penilaian Bintang">
                🌟
              </button>
            </div>
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

    // Klik tombol 📋 -> Langsung tampilkan halaman ulasan khusus produk ini saja
    const viewReviewsBtn = e.target.closest('.btn-view-reviews');
    if (viewReviewsBtn) {
      e.stopPropagation();
      const p = activeProducts.find(item => String(item.id) === String(viewReviewsBtn.dataset.id));
      if (p) {
        activeProductTestiFilter = p.name;
        location.hash = `#/ulasan?product=${encodeURIComponent(p.name)}`;
        renderNav();
        viewTestimoni();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    // Klik tombol 🌟 -> Langsung buka formulir untuk memberi ulasan produk ini
    const rateBtn = e.target.closest('.btn-rate-quick');
    if (rateBtn) {
      e.stopPropagation();
      const p = activeProducts.find(item => String(item.id) === String(rateBtn.dataset.id));
      if (p) openWriteReviewModal(activeProducts, p.name);
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

    // Klik rating bintang pada kartu -> Langsung buka ulasan khusus produk ini
    const ratingClick = e.target.closest('.card-rating');
    if (ratingClick) {
      e.stopPropagation();
      const p = activeProducts.find(item => String(item.id) === String(ratingClick.dataset.id));
      if (p) {
        activeProductTestiFilter = p.name;
        location.hash = `#/ulasan?product=${encodeURIComponent(p.name)}`;
        renderNav();
        viewTestimoni();
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
function openDetailModal(p, scrollToReviews = false) {
  const modalContainer = $('#modalContainer');
  if (!modalContainer) return;

  const imgs = [p.image, p.image2, p.image3].filter(Boolean);
  const multi = imgs.length > 1;

  const pStats = getProductRatingStats(p.name, p.id);
  const pReviews = pStats.reviews;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="detailModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
      <div class="modal-card modal-detail-card">
        <button type="button" class="modal-close" id="closeDetailModal" aria-label="Tutup detail">&times;</button>
        <div class="modal-body">
          <div class="modal-thumb ${multi ? 'multi' : ''}" id="modalThumb" ${multi ? 'tabindex="0" role="button" title="Sentuh untuk ganti foto"' : ''}>
            ${imgs.length ? imgs.map((s, i) => `<img class="${i === 0 ? 'on' : ''}" src="${esc(s)}" alt="${esc(p.name)} foto ${i + 1}">`).join('') : esc(p.name.charAt(0).toUpperCase())}
            ${multi ? `<span class="dots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</span>` : ''}
          </div>
          ${p.link ? `
            <div style="margin: 8px 0 10px;">
              <a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(90deg, #ec4899, #db2777); color:#fff; padding:9px 14px; border-radius:99px; font-weight:700; font-size:0.88rem; text-decoration:none; box-shadow:0 3px 10px rgba(219,39,119,0.25);">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                <span>Buka Link Website Ucapan Digital ↗</span>
              </a>
            </div>
          ` : ''}
          ${p.category ? `<span class="cat">${esc(p.category)}</span>` : ''}
          <h2 id="detailTitle" style="margin: 6px 0 6px; font-size: 1.25rem; color: var(--ink); line-height: 1.3;">${esc(p.name)}</h2>
          
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <div class="price" style="font-size: 1.25rem; font-weight: 700; color: var(--accent); margin: 0;">${rupiah(p.price)}</div>
            <div class="p-detail-rating" id="jumpToReviews" style="cursor: pointer; background: var(--soft); padding: 3px 10px; border-radius: 99px; border: 1px solid var(--line);" title="Lihat ulasan produk ini">
              ${pStats.count > 0 ? `<span class="star-gold">★</span> <strong>${pStats.avg}</strong> <span style="color: var(--muted); font-size: 0.82rem;">(${pStats.count} ulasan)</span>` : `<span class="star-gray">★</span> <span style="color: var(--muted); font-size: 0.82rem;">Belum ada ulasan</span>`}
            </div>
          </div>
          
          <div style="font-weight: 600; font-size: 0.88rem; color: var(--muted); margin-bottom: 6px;">Informasi &amp; Deskripsi Lengkap:</div>
          <div class="modal-desc">${esc(p.desc || 'Tidak ada keterangan tambahan.')}</div>
          
          <div class="modal-order-row" style="display: flex; gap: 8px; margin: 16px 0 6px;">
            <button type="button" class="btn primary" id="btnModalOrder" style="flex: 1; padding: 12px; font-size: 1rem; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              Order Sekarang
            </button>
            <button type="button" class="btn-action-icon btn-modal-icon" id="btnModalSeeReviews" title="Lihat Ulasan ${esc(p.name)}" aria-label="Lihat ulasan produk">
              📋
            </button>
            <button type="button" class="btn-action-icon btn-modal-icon" id="btnModalRateQuick" title="Beri Penilaian Bintang" aria-label="Beri penilaian produk">
              🌟
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const backdrop = $('#detailModalBackdrop');
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
  });

  const closeModal = () => {
    backdrop.classList.remove('show');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  $('#closeDetailModal').onclick = closeModal;

  const goToProductReviews = () => {
    modalContainer.innerHTML = '';
    activeProductTestiFilter = p.name;
    location.hash = `#/ulasan?product=${encodeURIComponent(p.name)}`;
    renderNav();
    viewTestimoni();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const seeAllBtn = $('#btnModalSeeReviews');
  if (seeAllBtn) seeAllBtn.onclick = goToProductReviews;

  const jumpReviews = $('#jumpToReviews');
  if (jumpReviews) jumpReviews.onclick = goToProductReviews;

  $('#btnModalOrder').onclick = () => {
    modalContainer.innerHTML = '';
    openOrderModal(p);
  };

  const btnModalRate = $('#btnModalRateQuick');
  if (btnModalRate) {
    btnModalRate.onclick = async () => {
      let products = [];
      try { products = await apiGetProducts(); } catch (_) {}
      const activeList = products.filter(item => item.active);
      if (!activeList.some(item => item.name === p.name)) activeList.push(p);
      modalContainer.innerHTML = '';
      openWriteReviewModal(activeList, p.name);
    };
  }

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
      const text = `${defaultMsg}\n\n*Nama Produk:* ${p.name}\n*Harga:* ${rupiah(p.price)}${p.link ? `\n*Link Web:* ${p.link}` : ''}`;
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

// ==============================================================
// TESTIMONI VIEW (SHOPEE STYLE DENGAN PENYIMPANAN LOKAL)
// ==============================================================
function renderStars(rating, max = 5) {
  let s = '';
  for (let i = 1; i <= max; i++) {
    s += i <= rating ? '<span class="star-gold">★</span>' : '<span class="star-gray">★</span>';
  }
  return s;
}

let activeTestiFilter = 'all';
let activeProductTestiFilter = ''; // Filter nama produk khusus, kosong = Semua Produk

async function viewTestimoni() {
  const app = $('#app');
  let products = [];
  try {
    products = await apiGetProducts();
  } catch (_) {
    products = [];
  }
  const activeProducts = products.filter(p => p.active);
  const session = await apiGetSession();

  // Cek apakah ada parameter ?product= di URL
  const hashQuery = location.hash.includes('?') ? location.hash.split('?')[1] : '';
  const params = new URLSearchParams(hashQuery);
  const paramProd = params.get('product');
  if (paramProd) {
    activeProductTestiFilter = decodeURIComponent(paramProd);
  }

  const allReviews = apiGetReviews();
  
  // Ambil ulasan KHUSUS produk yang dipilih, atau semua jika tidak difilter
  const reviews = activeProductTestiFilter 
    ? apiGetReviewsByProduct(activeProductTestiFilter) 
    : allReviews;

  const total = reviews.length;
  const sumRating = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  const avgRating = total > 0 ? (sumRating / total).toFixed(1) : '0.0';

  const countWithPhotos = reviews.filter(r => r.photos && r.photos.length > 0).length;
  const count5 = reviews.filter(r => Number(r.rating) === 5).length;
  const count4 = reviews.filter(r => Number(r.rating) === 4).length;
  const count3 = reviews.filter(r => Number(r.rating) === 3).length;
  const count2 = reviews.filter(r => Number(r.rating) === 2).length;
  const count1 = reviews.filter(r => Number(r.rating) === 1).length;

  app.innerHTML = `
    <div class="testi-page">
      <!-- Navigasi Atas & Tombol Tulis Ulasan -->
      <div class="testi-nav-bar">
        <a href="#/" class="btn sm">&larr; Kembali ke Katalog</a>
        <button type="button" class="btn primary btn-write-review" id="btnOpenWriteReview">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Tulis Ulasan / Testimoni
        </button>
      </div>

      ${activeProductTestiFilter ? `
        <div class="testi-filter-banner" style="display:flex; align-items:center; justify-content:space-between; background:var(--soft); border:1px solid var(--line); border-radius:12px; padding:10px 14px; margin-bottom:14px; gap:8px; flex-wrap:wrap;">
          <span style="font-size:0.9rem; color:var(--ink);">Menampilkan ulasan untuk: <strong>${esc(activeProductTestiFilter)}</strong></span>
          <button type="button" id="btnClearProdFilter" class="btn sm" style="font-size:0.8rem; padding:4px 10px; background:#fff;">&times; Tampilkan Semua Ulasan</button>
        </div>
      ` : ''}

      <!-- Ringkasan Nilai & Ulasan Shopee-Style -->
      <section class="shopee-summary-card">
        <div class="shopee-score-box">
          <div style="font-size: 0.82rem; color: var(--muted); font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
            ${activeProductTestiFilter ? `Ulasan ${esc(activeProductTestiFilter)}` : 'Rata-Rata Seluruh Toko'}
          </div>
          <div class="shopee-big-score">${total > 0 ? avgRating : '-'}<span class="shopee-score-max">/ 5</span></div>
          <div class="shopee-stars">${renderStars(total > 0 ? Math.round(Number(avgRating)) : 0)}</div>
          <div class="shopee-total-text">${total} Ulasan Pembeli</div>
        </div>

        <div class="shopee-bars-box">
          ${[
            { label: '5 Bintang', count: count5 },
            { label: '4 Bintang', count: count4 },
            { label: '3 Bintang', count: count3 },
            { label: '2 Bintang', count: count2 },
            { label: '1 Bintang', count: count1 }
          ].map(b => {
            const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
            return `
              <div class="shopee-bar-row">
                <span class="shopee-bar-label">${b.label}</span>
                <div class="shopee-bar-track">
                  <div class="shopee-bar-fill" style="width: ${pct}%"></div>
                </div>
                <span class="shopee-bar-count">(${b.count})</span>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Filter Kategori Ulasan Shopee-Style -->
      <div class="shopee-filter-tabs" id="shopeeFilters">
        <button type="button" class="shopee-tab ${activeTestiFilter === 'all' ? 'active' : ''}" data-filter="all">Semua (${total})</button>
        <button type="button" class="shopee-tab ${activeTestiFilter === 'photo' ? 'active' : ''}" data-filter="photo">Dengan Foto (${countWithPhotos})</button>
        <button type="button" class="shopee-tab ${activeTestiFilter === '5' ? 'active' : ''}" data-filter="5">5 Bintang (${count5})</button>
        <button type="button" class="shopee-tab ${activeTestiFilter === '4' ? 'active' : ''}" data-filter="4">4 Bintang (${count4})</button>
        <button type="button" class="shopee-tab ${activeTestiFilter === '3' ? 'active' : ''}" data-filter="3">3 Bintang (${count3})</button>
        <button type="button" class="shopee-tab ${activeTestiFilter === '2' ? 'active' : ''}" data-filter="2">2 Bintang (${count2})</button>
        <button type="button" class="shopee-tab ${activeTestiFilter === '1' ? 'active' : ''}" data-filter="1">1 Bintang (${count1})</button>
      </div>

      <!-- Daftar Kartu Ulasan -->
      <div class="shopee-reviews-list" id="reviewsList"></div>
    </div>
  `;

  // Render list review berdasarkan filter aktif
  const renderList = () => {
    const listContainer = $('#reviewsList');
    if (!listContainer) return;

    let filtered = reviews;
    if (activeTestiFilter === 'photo') {
      filtered = reviews.filter(r => r.photos && r.photos.length > 0);
    } else if (['1', '2', '3', '4', '5'].includes(activeTestiFilter)) {
      filtered = reviews.filter(r => Number(r.rating) === Number(activeTestiFilter));
    }

    if (!filtered.length) {
      listContainer.innerHTML = `
        <div class="empty">
          <div style="font-size:2.2rem; margin-bottom:8px">🌸</div>
          Belum ada ulasan untuk ${activeProductTestiFilter ? `produk <strong>"${esc(activeProductTestiFilter)}"</strong>` : 'kategori ini'}.<br>
          Jadilah yang pertama menulis ulasan &amp; upload foto hasil produk kamu!
        </div>
      `;
      return;
    }

    let likedList = [];
    try {
      likedList = JSON.parse(localStorage.getItem('klk_liked_reviews') || '[]');
    } catch (_) {}

    listContainer.innerHTML = filtered.map(r => {
      const initial = (r.name || 'P').trim().charAt(0).toUpperCase();
      const hasLiked = likedList.includes(r.id);
      return `
        <article class="shopee-review-item" data-id="${esc(r.id)}">
          <div class="shopee-item-header">
            <div class="shopee-avatar" aria-hidden="true">${esc(initial)}</div>
            <div class="shopee-user-info">
              <div class="shopee-user-name">
                ${esc(maskName(r.name))}
                <span class="shopee-verified-badge" title="Pembeli terverifikasi dari K.L.K Memories">✔ Pembeli Terverifikasi</span>
              </div>
              <div class="shopee-date">${esc(r.date || 'Baru saja')}</div>
            </div>
          </div>

          <div class="shopee-rating-row">
            <span class="shopee-stars-item">${renderStars(r.rating)}</span>
            ${r.productName ? `
              <button type="button" class="shopee-product-tag btn-filter-this-tag" data-p="${esc(r.productName)}" title="Lihat hanya ulasan ${esc(r.productName)}">
                📦 Produk: ${esc(r.productName)}
              </button>
            ` : ''}
          </div>

          <div class="shopee-comment-text">${esc(r.comment)}</div>

          ${r.photos && r.photos.length ? `
            <div class="shopee-photos-grid">
              ${r.photos.map(pUrl => `
                <div class="shopee-photo-thumb" data-photo="${esc(pUrl)}" tabindex="0" role="button" aria-label="Lihat foto hasil produk pembeli">
                  <img src="${esc(pUrl)}" alt="Foto ulasan dari ${esc(maskName(r.name))}" loading="lazy">
                  <span class="zoom-indicator">🔍</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="shopee-item-footer">
            <button type="button" class="btn-like-review ${hasLiked ? 'liked' : ''}" data-id="${esc(r.id)}">
              👍 Membantu (${r.likes || 0})
            </button>
            ${session ? `
              <button type="button" class="btn-del-review" data-id="${esc(r.id)}" title="Hapus ulasan ini">
                🗑️ Hapus Ulasan
              </button>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');
  };

  renderList();

  // Event Klik Tab Filter Shopee (Bintang / Foto)
  $('#shopeeFilters').onclick = e => {
    const tab = e.target.closest('.shopee-tab');
    if (!tab) return;
    activeTestiFilter = tab.dataset.filter;
    $('#shopeeFilters').querySelectorAll('.shopee-tab').forEach(t => t.classList.toggle('active', t === tab));
    renderList();
  };

  const clearBtn = $('#btnClearProdFilter');
  if (clearBtn) {
    clearBtn.onclick = () => {
      activeProductTestiFilter = '';
      if (location.hash.includes('?')) {
        location.hash = '#/ulasan';
      } else {
        viewTestimoni();
      }
    };
  }

  // Event Klik Tombol Tulis Ulasan (otomatis terisi nama produk aktif jika sedang filter per-produk)
  $('#btnOpenWriteReview').onclick = () => {
    openWriteReviewModal(activeProducts, activeProductTestiFilter);
  };

  // Delegated clicks di dalam list review: Like, Delete (Owner), Foto Zoom, Filter Tag
  $('#reviewsList').onclick = e => {
    // Klik tag produk untuk langsung memfilter ke ulasan produk tersebut
    const tagBtn = e.target.closest('.btn-filter-this-tag');
    if (tagBtn) {
      activeProductTestiFilter = tagBtn.dataset.p || '';
      viewTestimoni();
      return;
    }

    // Tombol Like
    const likeBtn = e.target.closest('.btn-like-review');
    if (likeBtn) {
      const id = likeBtn.dataset.id;
      const ok = apiLikeReview(id);
      if (ok) {
        toast('Terima kasih atas tanggapanmu! 👍');
        viewTestimoni();
      } else {
        toast('Kamu sudah menyukai ulasan ini.');
      }
      return;
    }

    // Tombol Hapus (Owner)
    const delBtn = e.target.closest('.btn-del-review');
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('Yakin ingin menghapus ulasan ini dari penyimpanan lokal?')) {
        apiDeleteReview(id);
        toast('Ulasan berhasil dihapus');
        viewTestimoni();
      }
      return;
    }

    // Klik Thumbnail Foto Ulasan
    const photoThumb = e.target.closest('.shopee-photo-thumb');
    if (photoThumb) {
      const photoUrl = photoThumb.dataset.photo;
      if (photoUrl) openPhotoLightbox(photoUrl);
      return;
    }
  };
}

// ==============================================================
// UCAPAN DIGITAL VIEW (KATALOG UCAPAN DIGITAL UNTUK PENGUNJUNG)
// ==============================================================
let activeUcapanCat = '';
async function viewUcapanDigital() {
  const app = $('#app');
  let products = [];
  try {
    products = await apiGetProducts();
  } catch (err) {
    products = [];
  }

  // Ambil hanya produk aktif tipe Ucapan Digital
  let ucapanProducts = products.filter(p => p.active && isUcapanProduct(p));

  // Kategori default
  const ucapanCats = ['Galery', 'Ucapan Ulangtahun'];
  const cats = [...new Set([...ucapanCats, ...ucapanProducts.map(p => p.category).filter(Boolean)])];

  if (activeUcapanCat && !cats.includes(activeUcapanCat)) activeUcapanCat = '';

  app.innerHTML = `
    <section class="hero">
      <div style="display:inline-flex; align-items:center; gap:6px; background:var(--soft); color:var(--accent); font-weight:700; padding:6px 16px; border-radius:99px; font-size:0.82rem; margin-bottom:10px; border:1px solid var(--line);">
        💌 Katalog Ucapan Digital K.L.K
      </div>
      <h1>Koleksi Ucapan Digital</h1>
      <p>Pilih tema kenangan manis &amp; buka link website ucapan digital interaktif untuk orang tersayang.</p>
      
      <input class="search" id="qUcapan" type="search" placeholder="Cari nama ucapan atau tema..." aria-label="Cari ucapan digital">
      <div class="chips" id="ucapanChips"></div>
    </section>

    <section class="grid" id="ucapanGrid">
      <div class="empty">Memuat ucapan digital...</div>
    </section>
  `;

  const chipsContainer = $('#ucapanChips');
  const drawUcapanChips = () => {
    chipsContainer.innerHTML = ['', ...cats].map(c =>
      `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === activeUcapanCat}">${c ? esc(c) : 'Semua'}</button>`
    ).join('');
  };

  const drawUcapanGrid = () => {
    const q = ($('#qUcapan')?.value || '').trim().toLowerCase();
    const list = ucapanProducts.filter(p => {
      const matchCat = !activeUcapanCat || p.category === activeUcapanCat;
      const matchQuery = (p.name + ' ' + (p.desc || '')).toLowerCase().includes(q);
      return matchCat && matchQuery;
    });

    const grid = $('#ucapanGrid');
    if (!list.length) {
      grid.innerHTML = `
        <div class="empty">
          <div style="font-size:2.2rem; margin-bottom:8px">💌</div>
          ${q || activeUcapanCat ? 'Tidak ada ucapan digital yang cocok.' : 'Belum ada ucapan digital yang diunggah.'}<br>
          <small style="color:var(--muted)">Owner dapat mengunggah melalui menu <strong>Kelola Produk &rarr; Ucapan Digital</strong>.</small>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(p => {
      const imgs = [p.image, p.image2, p.image3].filter(Boolean);
      const multi = imgs.length > 1;
      const descText = (p.desc || '').trim();
      const pStats = getProductRatingStats(p.name, p.id);
      return `
        <article class="card" data-id="${p.id}">
          <div class="thumb ${multi ? 'multi' : ''}" ${multi ? 'tabindex="0" role="button" aria-label="Ganti foto ' + esc(p.name) + '"' : ''}>
            ${imgs.length ? imgs.map((s, i) => `<img class="${i === 0 ? 'on' : ''}" src="${esc(s)}" alt="${esc(p.name)} foto ${i + 1}">`).join('') : '💌'}
            ${multi ? `<span class="dots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</span>` : ''}
          </div>
          <div class="body">
            ${p.link ? `
              <div class="card-link-box">
                <a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer" class="btn-web-link" title="Buka website ucapan: ${esc(p.link)}" onclick="event.stopPropagation()">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                  <span>Buka Web Ucapan ↗</span>
                </a>
              </div>
            ` : ''}
            ${p.category ? `<span class="cat">${esc(p.category)}</span>` : ''}
            <h3 class="card-title" title="${esc(p.name)}">${esc(p.name)}</h3>
            <div class="price">${rupiah(p.price)}</div>
            <div class="card-rating" data-id="${p.id}" role="button" tabindex="0" title="Lihat ulasan ${esc(p.name)}">
              ${pStats.count > 0 ? `<span class="star-gold">★</span> <strong>${pStats.avg}</strong> <span class="card-rating-count">(${pStats.count} ulasan)</span>` : `<span class="star-gray">★</span> <span class="card-rating-count">Belum ada ulasan</span>`}
            </div>
            ${descText ? `
              <p class="desc-snippet">${esc(descText)}</p>
              <button type="button" class="btn-readmore" data-id="${p.id}">Baca selengkapnya...</button>
            ` : ''}
            <div class="card-actions">
              <button type="button" class="btn-order" data-id="${p.id}" aria-label="Pesan ${esc(p.name)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                Order
              </button>
              <button type="button" class="btn-view-reviews" data-id="${p.id}" aria-label="Lihat ulasan untuk ${esc(p.name)}" title="Lihat Ulasan Produk Ini">
                📋
              </button>
              <button type="button" class="btn-rate-quick" data-id="${p.id}" aria-label="Beri penilaian untuk ${esc(p.name)}" title="Beri Penilaian Bintang">
                🌟
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  };

  // Event Listeners Filter
  $('#qUcapan').oninput = drawUcapanGrid;
  chipsContainer.onclick = e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    activeUcapanCat = b.dataset.c;
    drawUcapanChips();
    drawUcapanGrid();
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

  const grid = $('#ucapanGrid');
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
    const readMoreBtn = e.target.closest('.btn-readmore');
    if (readMoreBtn) {
      e.stopPropagation();
      const p = ucapanProducts.find(item => String(item.id) === String(readMoreBtn.dataset.id));
      if (p) openDetailModal(p);
      return;
    }

    const orderBtn = e.target.closest('.btn-order');
    if (orderBtn) {
      e.stopPropagation();
      const p = ucapanProducts.find(item => String(item.id) === String(orderBtn.dataset.id));
      if (p) openOrderModal(p);
      return;
    }

    const viewReviewsBtn = e.target.closest('.btn-view-reviews');
    if (viewReviewsBtn) {
      e.stopPropagation();
      const p = ucapanProducts.find(item => String(item.id) === String(viewReviewsBtn.dataset.id));
      if (p) {
        activeProductTestiFilter = p.name;
        location.hash = `#/ulasan?product=${encodeURIComponent(p.name)}`;
        renderNav();
        viewTestimoni();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const rateBtn = e.target.closest('.btn-rate-quick');
    if (rateBtn) {
      e.stopPropagation();
      const p = ucapanProducts.find(item => String(item.id) === String(rateBtn.dataset.id));
      if (p) openWriteReviewModal(ucapanProducts, p.name);
      return;
    }

    const titleClick = e.target.closest('.card-title');
    if (titleClick) {
      const card = titleClick.closest('.card');
      if (card) {
        const p = ucapanProducts.find(item => String(item.id) === String(card.dataset.id));
        if (p) openDetailModal(p);
      }
      return;
    }

    const ratingClick = e.target.closest('.card-rating');
    if (ratingClick) {
      e.stopPropagation();
      const p = ucapanProducts.find(item => String(item.id) === String(ratingClick.dataset.id));
      if (p) {
        activeProductTestiFilter = p.name;
        location.hash = `#/ulasan?product=${encodeURIComponent(p.name)}`;
        renderNav();
        viewTestimoni();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const t = e.target.closest('.multi');
    if (t) nextImage(t);
  };

  drawUcapanChips();
  drawUcapanGrid();
}

// Modal Formulir Tulis Ulasan / Testimoni Pembeli (Shopee Style)
function openWriteReviewModal(activeProducts, preselectedProductName = '') {
  const modalContainer = $('#modalContainer');
  if (!modalContainer) return;

  let selectedRating = 5;
  let selectedPhotos = []; // Array dataURL base64 terkompresi

  const ratingLabels = {
    1: 'Sangat Mengecewakan 😞',
    2: 'Kurang Puas 😐',
    3: 'Cukup Baik 🙂',
    4: 'Puas / Bagus! 😊',
    5: 'Sangat Puas / Sempurna! 😍'
  };

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="reviewModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="writeReviewTitle">
      <div class="modal-card modal-write-review">
        <button type="button" class="modal-close" id="closeReviewModal" aria-label="Tutup formulir ulasan">&times;</button>
        <div class="modal-body">
          <h2 id="writeReviewTitle" style="margin: 0 0 4px; font-size: 1.25rem; color: var(--ink);">Beri Penilaian Produk</h2>
          <p style="margin: 0 0 16px; font-size: 0.88rem; color: var(--muted);">
            Bagikan foto dan pengalamanmu belanja di K.L.K Memories untuk pembeli lainnya!
          </p>

          <form id="writeReviewForm" autocomplete="off">
            <!-- Pilihan Produk -->
            <label for="revProduct">Pilih Produk yang Diulas</label>
            <select id="revProduct" required>
              <option value="Layanan & Toko K.L.K (Umum)" ${!preselectedProductName ? 'selected' : ''}>Layanan &amp; Toko K.L.K (Umum)</option>
              ${activeProducts.map(p => `
                <option value="${esc(p.name)}" ${preselectedProductName === p.name ? 'selected' : ''}>
                  ${esc(p.name)}
                </option>
              `).join('')}
            </select>

            <!-- Rating Bintang 1-5 Interaktif -->
            <label>Kualitas Produk (Bintang 1 - 5)</label>
            <div class="star-rating-selector" id="starRatingSelector">
              <div class="star-rating-icons">
                ${[1, 2, 3, 4, 5].map(star => `
                  <button type="button" class="star-btn on" data-star="${star}" aria-label="Pilih ${star} bintang">★</button>
                `).join('')}
              </div>
              <div class="star-rating-label" id="starRatingLabel">Sangat Puas / Sempurna! 😍</div>
            </div>

            <!-- Nama Pembeli -->
            <label for="revName">Nama Pembeli</label>
            <input type="text" id="revName" required placeholder="Contoh: Amanda P. / Samaran" maxlength="40">

            <!-- Upload Foto Hasil Produk -->
            <label>Foto Hasil Produk (Maks 3 Foto)</label>
            <div class="photo-uploader-box">
              <div class="photo-preview-grid" id="photoPreviewGrid"></div>
              <button type="button" class="btn-pick-photos" id="btnPickPhotos">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>+ Tambah Foto Produk</span>
              </button>
              <input type="file" id="revPhotoInput" accept="image/*" multiple style="display: none;">
            </div>
            <div class="hint" style="margin-top: 4px;">Foto dikompres otomatis sehingga ringan dan cepat tersimpan di browser.</div>

            <!-- Deskripsi Ulasan -->
            <label for="revComment">Ulasan Produk</label>
            <textarea id="revComment" required placeholder="Ceritakan kepuasan kamu tentang hasil cetak foto, frame, gantungan kunci, kerapian kemasan, atau pelayanan..."></textarea>

            <div class="actions" style="margin-top: 18px;">
              <button type="submit" class="btn primary" id="btnSubmitReview" style="width: 100%; padding: 12px; font-size: 1rem;">
                Kirim Penilaian
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const backdrop = $('#reviewModalBackdrop');
  requestAnimationFrame(() => backdrop.classList.add('show'));

  const closeModal = () => {
    backdrop.classList.remove('show');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  $('#closeReviewModal').onclick = closeModal;
  backdrop.onclick = e => {
    if (e.target === backdrop) closeModal();
  };

  // Interaktivitas Bintang Rating
  const starBtns = backdrop.querySelectorAll('.star-btn');
  const starLabel = $('#starRatingLabel');

  const updateStarUI = (val) => {
    selectedRating = val;
    starBtns.forEach(btn => {
      const s = Number(btn.dataset.star);
      btn.classList.toggle('on', s <= val);
    });
    starLabel.textContent = ratingLabels[val] || '';
  };

  starBtns.forEach(btn => {
    btn.onclick = () => {
      updateStarUI(Number(btn.dataset.star));
    };
    btn.onmouseenter = () => {
      const s = Number(btn.dataset.star);
      starBtns.forEach(b => b.classList.toggle('hover', Number(b.dataset.star) <= s));
      starLabel.textContent = ratingLabels[s] || '';
    };
  });

  const selector = $('#starRatingSelector');
  selector.onmouseleave = () => {
    starBtns.forEach(b => b.classList.remove('hover'));
    updateStarUI(selectedRating);
  };

  // Upload Foto & Preview
  const fileInput = $('#revPhotoInput');
  const pickBtn = $('#btnPickPhotos');
  const previewGrid = $('#photoPreviewGrid');

  const updatePreviewGrid = () => {
    previewGrid.innerHTML = selectedPhotos.map((dataUrl, idx) => `
      <div class="preview-item">
        <img src="${dataUrl}" alt="Preview foto ${idx + 1}">
        <button type="button" class="btn-remove-photo" data-idx="${idx}" aria-label="Hapus foto">&times;</button>
      </div>
    `).join('');

    pickBtn.style.display = selectedPhotos.length >= 3 ? 'none' : 'inline-flex';
  };

  pickBtn.onclick = () => fileInput.click();

  fileInput.onchange = async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    for (const f of files) {
      if (selectedPhotos.length >= 3) break;
      if (!f.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImageToBase64(f);
        selectedPhotos.push(compressed);
      } catch (err) {
        console.error('Gagal memproses foto:', err);
      }
    }
    fileInput.value = '';
    updatePreviewGrid();
  };

  previewGrid.onclick = e => {
    const rm = e.target.closest('.btn-remove-photo');
    if (!rm) return;
    const idx = Number(rm.dataset.idx);
    selectedPhotos.splice(idx, 1);
    updatePreviewGrid();
  };

  // Submit Form Ulasan
  $('#writeReviewForm').onsubmit = e => {
    e.preventDefault();
    const name = ($('#revName').value || '').trim();
    const productName = $('#revProduct').value;
    const comment = ($('#revComment').value || '').trim();

    if (!name || !comment) {
      toast('Silakan lengkapi nama dan ulasan Anda');
      return;
    }

    try {
      const matched = activeProducts.find(x => x.name === productName);
      apiSaveReview({
        productId: matched ? matched.id : '',
        name,
        productName,
        rating: selectedRating,
        comment,
        photos: selectedPhotos
      });
      toast(`Terima kasih! Penilaian kamu berhasil dikirim 💕`);
      closeModal();
      
      // Langsung berpindah ke halaman penilaiannya (ulasan)
      activeProductTestiFilter = '';
      if (location.hash === '#/ulasan' || location.hash === '#/testimoni') {
        renderNav();
        viewTestimoni();
      } else {
        location.hash = '#/ulasan';
      }
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    } catch (err) {
      toast(err.message || 'Gagal menyimpan ulasan');
    }
  };
}

// Lightbox Pop-up Foto Ulasan
function openPhotoLightbox(photoUrl) {
  const modalContainer = $('#modalContainer');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="lightbox-backdrop" id="photoLightbox" role="dialog" aria-modal="true">
      <button type="button" class="lightbox-close" id="closeLightbox" aria-label="Tutup foto">&times;</button>
      <div class="lightbox-content">
        <img src="${esc(photoUrl)}" alt="Foto hasil produk asli dari pembeli">
      </div>
    </div>
  `;

  const lb = $('#photoLightbox');
  requestAnimationFrame(() => lb.classList.add('show'));

  const closeLb = () => {
    lb.classList.remove('show');
    setTimeout(() => { modalContainer.innerHTML = ''; }, 250);
  };

  $('#closeLightbox').onclick = closeLb;
  lb.onclick = e => {
    if (e.target === lb || e.target.classList.contains('lightbox-content')) closeLb();
  };
}

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

async function viewAdmin(adminType = null) {
  if (!adminType) {
    adminType = location.hash.startsWith('#/admin-ucapan') ? 'ucapan' : 'keychain';
  }
  const isUcapan = adminType === 'ucapan';

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
    name: '', category: '', price: '', desc: '', link: '', image: '', image2: '', image3: ''
  };

  img1Url = p.image || '';
  img2Url = p.image2 || '';
  img3Url = p.image3 || '';
  img1File = null; img2File = null; img3File = null;

  const catOptionsHtml = isUcapan
    ? `
      <option value="" disabled ${p.category ? '' : 'selected'}>Pilih kategori</option>
      <option value="Galery" ${p.category === 'Galery' ? 'selected' : ''}>Galery</option>
      <option value="Ucapan Ulangtahun" ${p.category === 'Ucapan Ulangtahun' ? 'selected' : ''}>Ucapan Ulangtahun</option>
    `
    : `
      <option value="" disabled ${p.category ? '' : 'selected'}>Pilih kategori</option>
      ${categories.map(c => `<option value="${esc(c)}" ${c === p.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    `;

  const catChipsHtml = categories.length ? categories.map(c => {
    const count = products.filter(x => x.category === c).length;
    return `
      <span class="chip" style="display:inline-flex;gap:8px;align-items:center">
        <span>${esc(c)} <small style="opacity:0.7">(${count})</small></span>
        <button type="button" class="btn sm danger" data-del-cat="${esc(c)}" aria-label="Hapus kategori ${esc(c)}" style="padding:2px 8px;font-size:0.8rem;line-height:1">×</button>
      </span>
    `;
  }).join('') : '<span class="hint">Belum ada kategori. Silakan tambahkan.</span>';

  // Filter produk sesuai tab admin aktif
  const filteredProducts = products.filter(x => isUcapan ? isUcapanProduct(x) : isKeychainProduct(x));

  $('#app').innerHTML = `
    <!-- Tab Navigasi Admin -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <a href="#/admin" class="btn sm ${!isUcapan ? 'primary' : ''}" style="font-weight:600">🔑 Kelola Keychain</a>
      <a href="#/admin-ucapan" class="btn sm ${isUcapan ? 'primary' : ''}" style="font-weight:600">💌 Kelola Ucapan Digital</a>
    </div>

    <!-- Kelola Kategori (Hanya ditampilkan di Keychain) -->
    ${!isUcapan ? `
      <section class="panel">
        <h2>Kategori Produk Keychain</h2>
        <label for="nc">Tambah Kategori Baru</label>
        <div class="up">
          <input type="text" id="nc" placeholder="Contoh: Frame foto, Gantungan kunci, Aksesoris">
          <button class="btn primary" type="button" id="addcat">Tambah</button>
        </div>
        <div class="chips" id="catlist" style="margin-top:14px">${catChipsHtml}</div>
      </section>
    ` : ''}

    <!-- Formulir Tambah / Edit Produk -->
    <form class="panel" id="productForm">
      <h2>${editId ? (isUcapan ? 'Ubah Ucapan Digital' : 'Ubah Produk Keychain') : (isUcapan ? 'Upload Ucapan Digital Baru' : 'Tambah Produk Keychain Baru')}</h2>
      
      <div class="row">
        <div>
          <label for="pName">${isUcapan ? 'Nama Produk Ucapan Digital' : 'Nama Produk / Desain'}</label>
          <input type="text" id="pName" required value="${esc(p.name)}" placeholder="${isUcapan ? 'Contoh: Web Ucapan Sweet 17' : 'Nama produk'}">
        </div>
        <div>
          <label for="pCat">Kategori</label>
          <select id="pCat" required>
            ${catOptionsHtml}
          </select>
        </div>
      </div>

      <div class="row">
        <div>
          <label for="pPrice">Harga (Rp)</label>
          <input type="number" id="pPrice" min="0" step="100" required value="${esc(p.price)}" placeholder="${isUcapan ? '35000' : '25000'}">
        </div>
        <div>
          ${isUcapan ? `
            <label for="pLink">Upload Link (Web Link Ucapan Digital) *</label>
            <input type="url" id="pLink" required value="${esc(p.link || '')}" placeholder="https://contoh-link-ucapan.com">
          ` : ''}
        </div>
      </div>

      ${isUcapan ? `
        <div class="hint" style="margin-top:-6px;margin-bottom:12px;">
          🌐 Link website ini akan tampil di bawah foto produk dan dapat langsung diklik oleh pelanggan untuk membuka website ucapan.
        </div>
      ` : ''}

      <label for="pDesc">Deskripsi Produk (Opsional)</label>
      <textarea id="pDesc" placeholder="${isUcapan ? 'Keterangan ucapan digital, fitur musik latar, galeri foto kenangan, ucapan ultah, dll.' : 'Keterangan ukuran, bahan, atau cara pemesanan'}">${esc(p.desc)}</textarea>

      <!-- Upload Foto 1 -->
      <div class="row" style="margin-top:10px">
        <div>
          <label for="i1">Foto Depan (Utama) *</label>
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
        <button class="btn primary" type="submit" id="saveBtn">${editId ? 'Simpan Perubahan' : (isUcapan ? 'Unggah Ucapan Digital' : 'Unggah Produk')}</button>
        ${editId ? '<button class="btn" type="button" id="cancelEdit">Batal</button>' : ''}
      </div>
    </form>

    <!-- Daftar Produk -->
    <section class="panel">
      <h2>${isUcapan ? `Daftar Ucapan Digital (${filteredProducts.length})` : `Daftar Produk Keychain (${filteredProducts.length})`}</h2>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nama Produk</th>
              <th>Kategori</th>
              <th>Harga</th>
              ${isUcapan ? '<th>Link Web</th>' : ''}
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${filteredProducts.length ? filteredProducts.map(x => `
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
                ${isUcapan ? `
                  <td>
                    ${x.link ? `
                      <a href="${esc(x.link)}" target="_blank" rel="noopener noreferrer" class="btn sm" style="font-size:0.75rem;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;text-decoration:none">
                        🌐 Buka Link ↗
                      </a>
                    ` : '<span class="hint">Kosong</span>'}
                  </td>
                ` : ''}
                <td><span class="tag ${x.active ? '' : 'off'}">${x.active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td>
                  <div class="cells">
                    <button class="btn sm" data-action="toggle" data-id="${x.id}">${x.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    <button class="btn sm" data-action="edit" data-id="${x.id}">Ubah</button>
                    <button class="btn sm danger" data-action="del" data-id="${x.id}">Hapus</button>
                  </div>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="${isUcapan ? 7 : 6}" style="text-align:center;padding:24px">${isUcapan ? 'Belum ada ucapan digital. Silakan unggah pada formulir di atas.' : 'Belum ada produk keychain. Silakan tambah pada formulir di atas.'}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;

  // Listener Kategori (Hanya jika mode Keychain)
  if (!isUcapan) {
    const addCat = async () => {
      const val = $('#nc').value.trim();
      if (!val) return;
      try {
        await apiAddCategory(val);
        toast('Kategori ditambahkan');
        viewAdmin(adminType);
      } catch (e) {
        toast(e.message || 'Gagal menambah kategori');
      }
    };
    if ($('#addcat')) $('#addcat').onclick = addCat;
    if ($('#nc')) $('#nc').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } };

    if ($('#catlist')) {
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
            viewAdmin(adminType);
          } catch (err) {
            console.error(err);
            toast(err.message || 'Gagal menghapus kategori');
            btn.disabled = false;
          }
        }
      };
    }
  }

  // Preview Foto saat dipilih
  const setupFilePick = (inputId, pvId, onPick) => {
    const el = $(inputId);
    if (!el) return;
    el.onchange = e => {
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
    $('#cancelEdit').onclick = () => { editId = null; viewAdmin(adminType); };
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

      const linkVal = isUcapan ? ($('#pLink')?.value || '').trim() : '';

      const productData = {
        name: $('#pName').value.trim(),
        category: $('#pCat').value,
        price: Number($('#pPrice').value),
        desc: ($('#pDesc')?.value || '').trim(),
        link: linkVal,
        product_type: isUcapan ? 'ucapan' : 'keychain',
        image: img1Url,
        image2: img2Url,
        image3: img3Url
      };

      await apiSaveProduct(productData, editId);
      toast(editId ? (isUcapan ? 'Ucapan Digital berhasil diubah' : 'Produk berhasil diubah') : (isUcapan ? 'Ucapan Digital berhasil diunggah' : 'Produk berhasil ditambahkan'));
      editId = null;
      viewAdmin(adminType);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Gagal menyimpan produk');
      saveBtn.disabled = false;
      saveBtn.textContent = editId ? 'Simpan Perubahan' : (isUcapan ? 'Unggah Ucapan Digital' : 'Unggah Produk');
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
        viewAdmin(adminType);
      } catch (err) {
        toast('Gagal mengubah status');
      }
    } else if (action === 'edit') {
      editId = item.id;
      viewAdmin(adminType);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else if (action === 'del') {
      if (confirm(`Yakin ingin menghapus "${item.name}"?`)) {
        try {
          await apiDeleteProduct(item.id);
          toast('Produk dihapus');
          viewAdmin(adminType);
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

document.addEventListener('click', () => {
  const drop = $('#adminDropdown');
  if (drop) drop.classList.remove('open');
});
