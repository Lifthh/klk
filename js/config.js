// ==============================================================
// KONFIGURASI SUPABASE K.L.K MEMORIES
// ==============================================================
// Ganti nilai di bawah ini dengan URL & Anon Key dari project Supabase kamu:
// (Bisa dilihat di: Supabase Dashboard -> Project Settings -> API)

const SUPABASE_CONFIG = {
  url: 'https://npckibykwaqjcrarfbkv.supabase.co',         // Contoh: https://xyzcompany.supabase.co
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY2tpYnlrd2FxamNyYXJmYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MTUwNDAsImV4cCI6MjEwODQ5MTA0MH0.1V_f4LwpNX9fxSpQtzxn_56y5ftgcBIEZIplTVr7beA' // Contoh: eyJhbGciOi...
};

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
