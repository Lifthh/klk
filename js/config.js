// ==============================================================
// KONFIGURASI SUPABASE K.L.K MEMORIES
// ==============================================================
// Ganti nilai di bawah ini dengan URL & Anon Key dari project Supabase kamu:
// (Bisa dilihat di: Supabase Dashboard -> Project Settings -> API)

const SUPABASE_CONFIG = {
  url: 'https://npckibykwaqjcrarfbkv.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY2tpYnlrd2FxamNyYXJmYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MTUwNDAsImV4cCI6MjEwODQ5MTA0MH0.1V_f4LwpNX9fxSpQtzxn_56y5ftgcBIEZIplTVr7beA'
};

// ==============================================================
// KONFIGURASI NOMOR WHATSAPP ADMIN UNTUK ORDER
// ==============================================================
// Ganti nomor di bawah ini dengan nomor WhatsApp aktif kamu.
// Gunakan kode negara 62 (tanpa spasi dan tanpa tanda +). Contoh: '6281234567890'
const ADMIN_CONTACTS = [
  { name: 'Admin 1', phone: '628212769293' },
        { name: 'Admin 2', phone: '6285287140773' },
        { name: 'Admin 3', phone: '6282321982264' }
];

// Pesan otomatis saat pelanggan membuka WhatsApp untuk memesan
const ORDER_MESSAGE = 'mauu orderr donng kaa';

// Inisialisasi Supabase Client jika SDK tersedia & konfigurasi sudah diisi
const isSupabaseConfigured = () => {
  return (
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_CONFIG.anonKey &&
    SUPABASE_CONFIG.anonKey !== 'YOUR_SUPABASE_ANON_KEY'
  );
};

let supabaseClient = null;
if (window.supabase && isSupabaseConfigured()) {
  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}
