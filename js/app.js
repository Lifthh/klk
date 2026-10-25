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
  const cats = categories.length ? categories : [...new Set(activeProducts.map(p => p.category).filter(Boolean))].sort();

  if (activeCat && !cats.includes(activeCat)) activeCat = '';

  const chipsContainer = $('#chips');
  const drawChips = () => {
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
      return `
        <article class="card">
          <div class="thumb ${multi ? 'multi' : ''}" ${multi ? 'tabindex="0" role="button" aria-label="Ganti foto ' + esc(p.name) + '"' : ''}>
            ${imgs.length ? imgs.map((s, i) => `<img class="${i === 0 ? 'on' : ''}" src="${esc(s)}" alt="${esc(p.name)} foto ${i + 1}">`).join('') : esc(p.name.charAt(0).toUpperCase())}
            ${multi ? `<span class="dots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</span>` : ''}
          </div>
          <div class="body">
            ${p.category ? `<span class="cat">${esc(p.category)}</span>` : ''}
            <h3>${esc(p.name)}</h3>
            <div class="price">${rupiah(p.price)}</div>
            <p>${esc(p.desc)}</p>
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

  const catChipsHtml = categories.length ? categories.map(c => `
    <span class="chip" style="display:inline-flex;gap:8px;align-items:center">
      ${esc(c)}
      <button type="button" class="btn sm danger" data-del-cat="${esc(c)}" aria-label="Hapus kategori ${esc(c)}">×</button>
    </span>
  `).join('') : '<span class="hint">Belum ada kategori. Silakan tambahkan.</span>';

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
    if (confirm(`Hapus kategori "${catName}"?`)) {
      try {
        await apiDeleteCategory(catName);
        toast('Kategori dihapus');
        viewAdmin();
      } catch (err) {
        toast('Gagal menghapus kategori');
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
