// ==============================================================
// KONFIGURASI SUPABASE K.L.K MEMORIES (AUTO-SWITCH ENVIRONMENT)
// ==============================================================

const ENV_CONFIGS = {
  // Database Uji Coba (Dev / Testing)
  development: {
    url: 'https://xuajgzmwljbjsguxntkp.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1YWpnem13bGpianNndXhudGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MTY2MjksImV4cCI6MjEwOTE5MjYyOX0.IeLv08VSeOy77orBfjiGMi7DMEFQcqhWB_0zFp_IPI4'
  },

  // Database Asli (Production Live)
  production: {
    url: 'https://npckibykwaqjcrarfbkv.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY2tpYnlrd2FxamNyYXJmYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MTUwNDAsImV4cCI6MjEwODQ5MTA0MH0.1V_f4LwpNX9fxSpQtzxn_56y5ftgcBIEZIplTVr7beA'
  }
};

// Auto-deteksi: jika di localhost atau 127.0.0.1 -> otomatis pakai development
// Jika di domain live / Vercel -> otomatis pakai production
const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === ''
);

const CURRENT_ENV = isLocalhost ? 'development' : 'production';
const SUPABASE_CONFIG = ENV_CONFIGS[CURRENT_ENV];

if (typeof console !== 'undefined' && console.log) {
  console.log(`%c[DB MODE] Aktif: ${CURRENT_ENV.toUpperCase()} (${SUPABASE_CONFIG.url})`, 'background: #2b3a4a; color: #5eead4; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
}

// ==============================================================
// KONFIGURASI NOMOR WHATSAPP ADMIN UNTUK ORDER
// ==============================================================
const ADMIN_CONTACTS = [
  { name: 'Admin 1', phone: '628212769293' },
  { name: 'Admin 2', phone: '6285287140773' },
  { name: 'Admin 3', phone: '6282321982264' }
];

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
if (typeof window !== 'undefined' && window.supabase && isSupabaseConfigured()) {
  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}
