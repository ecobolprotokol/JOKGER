# Spesifikasi Frontend Baseline Final JOKGER (React)

Dokumen ini adalah sumber kebenaran untuk seluruh lapisan frontend JOKGER. Dokumen ini melengkapi **Spesifikasi Teknis Baseline Final JOKGER (React)** dan mengikuti semua keputusan D1 sampai D16, katalog RPC, kode error, dan aturan bisnis di dokumen tersebut. Jika ada yang tidak tertulis di sini, AI coding harus berhenti dan bertanya, bukan menebak.

Bagian 2 berisi amandemen kecil terhadap baseline yang ditemukan saat menyusun spesifikasi ini. Amandemen itu berlaku mulai sekarang dan harus diterapkan juga di backend.

---

## 1. Aturan Wajib Frontend

1. Semua teks yang tampil ke pengguna berada di `shared/strings/id.ts`. Dilarang menulis string Indonesia langsung di JSX, kecuali `aria-label` yang juga diambil dari file yang sama.
2. Dilarang `dangerouslySetInnerHTML`. Data pengguna (nama menu, catatan, nama pelanggan, nama staff) hanya dirender sebagai teks React.
3. Dilarang memanggil `supabase.from(...).insert|update|upsert|delete`. Semua penulisan data operasional lewat `rpc()`. Pengecualian: upload ke Storage dan `fetch('/api/admin/create-staff')`.
4. Dilarang `console.*` di kode produksi. Gunakan `shared/lib/logger.ts`.
5. Dilarang `any`, `@ts-ignore`, `@ts-expect-error`, atau `eslint-disable` tanpa komentar justifikasi satu baris yang menjelaskan alasan teknis.
6. Dilarang menyimpan token, data transaksi, data staff, atau nomor rekening di `localStorage` atau `sessionStorage`. Pengecualian yang diizinkan hanya yang tercantum di bagian 8.
7. Dilarang memakai CDN eksternal untuk script, stylesheet, atau font. Semua aset dibundel lewat npm.
8. Dilarang update optimistik untuk transaksi uang, stok, atau status pesanan. Update optimistik hanya untuk toggle sederhana (`is_available`, `is_active` menu) dengan rollback otomatis.
9. Setiap komponen yang menampilkan uang memakai komponen `Money`. Dilarang memformat rupiah secara manual.
10. Setiap layar wajib memiliki empat state: memuat, kosong, error, dan berhasil. Tidak ada layar yang menampilkan layar kosong saat sebenarnya sedang memuat.
11. Semua aksi destruktif memakai `ConfirmAction`. Aksi yang mewajibkan alasan tidak boleh diajukan tanpa alasan.
12. Tidak ada mock data, placeholder, atau `TODO` di kode produksi.

---

## 2. Amandemen terhadap Baseline

Amandemen ini ditemukan saat menyusun spesifikasi frontend. Setiap amandemen wajib diterapkan di backend dan diuji.

**A1. Idempotensi untuk transaksi uang.** Saat ini `create_order`, `submit_payment`, dan `close_open_bill` tidak memiliki mekanisme pencegahan duplikat. Jika request timeout tetapi sebenarnya berhasil di server, kasir bisa mengirim ulang dan membuat pesanan ganda. Tambahkan parameter `p_client_ref uuid` pada ketiga RPC tersebut, disimpan di tabel `client_requests (client_ref uuid primary key, rpc_name text, result_id uuid, created_at timestamptz)`. Jika `client_ref` sudah ada, RPC mengembalikan hasil yang sama tanpa mengubah data apa pun. Frontend membuat UUID baru untuk setiap niat transaksi dan memakai ulang UUID yang sama untuk retry.

**A2. Batas sesi.** Batas idle 8 jam ditegakkan di klien (bagian 6.4). Di Supabase Auth, atur JWT expiry dan refresh token agar sesi tidak melebihi 8 jam tanpa aktivitas. RLS tidak memeriksa waktu. Pengaturan Supabase ini dicatat sebagai langkah manual pemilik.

**A3. Harga berubah saat checkout.** Klien mengirim `p_payments` berdasarkan total pratinjau. Jika harga menu berubah di server, RPC menolak dengan `PAYMENT_EXCEEDS_OUTSTANDING` (jika total server lebih rendah) atau `CASH_RECEIVED_INSUFFICIENT` (jika lebih tinggi). Klien memperlakukan kedua kode ini sebagai "harga berubah" (bagian 13.3.6). Pesanan tidak dibuat dan keranjang dipertahankan.

**A4. Rute verifikasi.** Rute resmi adalah `/payment-verification`. Tidak ada rute lain untuk fitur ini.

**A5. Batas idle dan sesi di layar POS.** Di layar POS, idle timer tetap berjalan. Keranjang tidak hilang saat logout paksa karena disimpan di localStorage (bagian 8.3), tetapi isi keranjang tidak boleh dikirim ulang tanpa login baru.

---

## 3. Ruang Lingkup dan Sumber Kebenaran

**Termasuk:** seluruh route, layout, state, form, komponen, realtime, cetak struk di browser, tema dan branding saat runtime, aksesibilitas, responsivitas, performa, dan pengujian frontend.

**Sumber kebenaran:**
- Aturan bisnis, RPC, error, dan RLS: Spesifikasi Baseline Final.
- Visual, layout, dan interaksi: dokumen ini.
- Jika bertentangan, Spesifikasi Baseline Final menang untuk data dan logika; dokumen ini menang untuk tampilan dan interaksi.

---

## 4. Stak dan Versi Frontend

| Paket | Versi | Fungsi |
|---|---|---|
| react, react-dom | 18.3.x | UI |
| typescript | 5.5+ | Bahasa, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| vite, @vitejs/plugin-react | 5.x | Build dan dev server |
| react-router-dom | 6.28+ | Routing dengan `lazy` |
| @tanstack/react-query | 5.x | Data server |
| zustand | 5.x | State lokal (keranjang, perangkat, tema) |
| react-hook-form, @hookform/resolvers | 7.x, 3.x | Form |
| zod | 3.23+ | Validasi |
| @supabase/supabase-js | 2.x | Akses Supabase |
| tailwindcss | 3.4.x | Styling |
| @radix-ui/* | sesuai shadcn | Primitif aksesibel |
| class-variance-authority, clsx, tailwind-merge | terbaru | Varian komponen |
| sonner | terbaru | Toast |
| lucide-react | terbaru | Ikon |
| date-fns | 3.x | Tanggal |
| @fontsource/inter, @fontsource/plus-jakarta-sans, @fontsource/poppins | terbaru | Font lokal |
| @point-of-sale/receipt-printer-encoder | terbaru | ESC/POS |
| @sentry/react | 8.x | Error tracking |
| vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom | vitest 2.x | Test |
| @playwright/test, @axe-core/playwright | terbaru | E2E dan aksesibilitas |

Dilarang menambah UI library lain (MUI, Chakra, Ant Design, dan sejenisnya).

---

## 5. Struktur dan Aturan Impor

### 5.1 Struktur folder

```
apps/web/src/
├─ main.tsx
├─ app/
│  ├─ App.tsx
│  ├─ router.tsx
│  ├─ providers.tsx
│  ├─ guards/RequireAuth.tsx
│  ├─ guards/RequireRole.tsx
│  ├─ layouts/AppShell.tsx
│  ├─ layouts/PosLayout.tsx
│  └─ errors/{RouteErrorBoundary.tsx, NotFoundPage.tsx, ForbiddenPage.tsx}
├─ features/<nama-fitur>/
│  ├─ components/
│  ├─ api.ts          # satu-satunya tempat memanggil supabase
│  ├─ hooks.ts        # hook TanStack Query dan mutasi
│  ├─ logic.ts        # fungsi murni
│  ├─ schemas.ts      # skema Zod
│  ├─ types.ts        # tipe khusus fitur
│  └─ index.ts        # ekspor publik fitur
├─ shared/
│  ├─ ui/             # komponen primitif hasil shadcn
│  ├─ components/     # komponen aplikasi lintas fitur
│  ├─ lib/            # money.ts, datetime.ts, errors.ts, logger.ts, supabase.ts, contrast.ts, csv.ts, receipt.ts, format.ts
│  ├─ stores/         # cart.ts, device.ts, theme.ts
│  ├─ hooks/          # useRealtime.ts, useShortcut.ts, useDebouncedValue.ts, useIdleTimeout.ts, useUnsavedChanges.ts
│  ├─ strings/id.ts
│  ├─ types/database.ts   # hasil generate, tidak diedit manual
│  └─ styles/index.css
└─ tests/               # setup dan util render
```

Fitur daftar: `auth`, `pos`, `open-bill`, `orders`, `history`, `shift`, `menu`, `inventory`, `opname`, `vouchers`, `payment-accounts`, `payment-verification`, `reports`, `settings`, `branding`, `staff`, `printing`, `audit`.

### 5.2 Aturan impor (ditegakkan ESLint)

- Fitur hanya boleh mengimpor dari `shared/*` dan dari `features/<fitur-lain>/index.ts`.
- Dilarang mengimpor file internal fitur lain (`features/x/api.ts` dari fitur `y`).
- Hanya `features/*/api.ts` dan `shared/lib/supabase.ts` yang boleh mengimpor `@supabase/supabase-js`.
- Hanya `shared/lib/money.ts` yang boleh berisi operasi aritmetika uang di klien selain fungsi `calculateTotals` di `features/pos/logic.ts`.
- Dilarang mengimpor `@fontsource` di luar `shared/styles/fonts.ts`.
- Konfigurasi ESLint memakai `eslint-plugin-import` dengan `no-restricted-imports` dan `no-restricted-syntax` untuk pola `.from(...)` yang dilarang.

### 5.3 Aturan penamaan

- Komponen: PascalCase, satu komponen per file, nama file sama dengan nama komponen.
- Hook: `useNama`.
- Fungsi murni: kata kerja, misalnya `calculateTotals`, `validateVoucher`.
- Konstanta: `SCREAMING_SNAKE_CASE`.
- Query key: array dengan elemen pertama nama domain, misalnya `['orders', filter]`.
- Route path: kebab-case.

---

## 6. Bootstrap, Provider, dan Routing

### 6.1 Urutan bootstrap

1. `main.tsx` menginisialisasi Sentry jika `VITE_SENTRY_DSN` ada.
2. `main.tsx` menerapkan tema awal dari `themeStore` sebelum render untuk mencegah kedipan.
3. `App` merender provider dalam urutan: `ErrorBoundary` → `QueryClientProvider` → `SessionProvider` → `BrandingProvider` → `ThemeProvider` → `RouterProvider` → `Toaster` → `ShortcutProvider`.
4. `BrandingProvider` mengambil `store_settings` lewat query `['settings']` dan menerapkan warna, font, dan judul dokumen.

### 6.2 QueryClient

- `staleTime`: 30 detik untuk data umum. 0 untuk shift aktif, pesanan aktif, dan antrian verifikasi.
- `gcTime`: 5 menit.
- `retry`: 1 kali untuk query yang bukan error otorisasi. Tidak ada retry untuk mutasi.
- `refetchOnWindowFocus`: true.
- Error otorisasi (`NOT_AUTHORIZED`, JWT expired) tidak di-retry dan memicu pengecekan sesi.
- `onError` global hanya mencatat ke logger dan menampilkan toast untuk mutasi. Query tidak menampilkan toast global.

### 6.3 Route

| Path | Peran | Layout | Catatan |
|---|---|---|---|
| `/login` | publik | Kosong | Redirect ke `/` jika sudah login |
| `/` | staff | - | Redirect: shift terbuka → `/pos`, tidak ada → `/shift` |
| `/pos` | staff | PosLayout | |
| `/pos/open-bill/:orderId` | staff | PosLayout | |
| `/orders` | staff | AppShell | Filter via query string |
| `/orders/:orderId` | staff | AppShell | Panel detail di desktop, halaman penuh di mobile |
| `/history` | staff | AppShell | |
| `/shift` | staff | AppShell | |
| `/menu` | staff | AppShell | |
| `/inventory` | staff | AppShell | |
| `/inventory/opname` | staff | AppShell | |
| `/inventory/opname/:opnameId` | staff | AppShell | |
| `/vouchers` | staff | AppShell | |
| `/payment-accounts` | staff | AppShell | |
| `/payment-verification` | staff | AppShell | |
| `/reports` | staff | AppShell | |
| `/settings` | super_admin | AppShell | |
| `/settings/branding` | super_admin | AppShell | |
| `/settings/staff` | super_admin | AppShell | |
| `/settings/printer` | staff | AppShell | D9 |
| `/audit` | super_admin | AppShell | |
| `/403` | publik | AppShell | |
| `*` | publik | Kosong | 404 |

Semua route selain `/login` dimuat dengan `lazy`. Setiap route dibungkus `RouteErrorBoundary`.

### 6.4 Guard dan sesi

**RequireAuth**
- Saat sesi belum diketahui, tampilkan skeleton layar penuh dengan `role="status"`, bukan halaman kosong.
- Jika tidak ada sesi, redirect ke `/login` dengan query `?redirect=<path>`. Setelah login, kembali ke path tersebut, kecuali path tersebut `/login`.
- Jika sesi ada tetapi tidak ada baris `profiles` yang bisa dibaca (akun nonaktif, atau RLS menolak), lakukan sign out dan tampilkan pesan "Akun Anda tidak aktif. Hubungi pemilik." di layar login.

**RequireRole**
- Membaca `role` dari sesi. Jika tidak cocok, render `/403`. URL tidak berubah.
- Pemeriksaan ini hanya untuk UX. Keamanan tetap dari RLS dan RPC.

**Idle timeout (`useIdleTimeout`)**
- Mencatat aktivitas dari `pointerdown`, `keydown`, `touchstart`, `scroll` dengan throttle 30 detik.
- Memeriksa setiap 60 detik. Jika idle 8 jam, sign out, bersihkan query cache, dan tampilkan pesan "Sesi berakhir karena tidak ada aktivitas."
- Sebelum sign out karena idle, tidak ada peringatan. Ini disengaja untuk menghindari gangguan di kasir.

**Refresh token**
- Ditangani supabase-js. Kegagalan refresh memicu sign out dengan pesan "Sesi berakhir. Masuk kembali."

**Sign out**
- Panggil `supabase.auth.signOut()`, `queryClient.clear()`, dan bersihkan `cartStore`? Tidak. Keranjang dipertahankan untuk login berikutnya di perangkat yang sama, kecuali pengguna memilih "Kosongkan keranjang" sebelum keluar. Jika keranjang berisi item, tampilkan konfirmasi "Keranjang belum dibuat pesanan. Tetap simpan?" dengan dua pilihan.

### 6.5 Redirect setelah login

1. Muat profil dan peran.
2. Muat shift aktif.
3. Jika shift aktif ada, ke `/pos`.
4. Jika tidak ada, ke `/shift`.
5. Jika ada `redirect` di query dan path tersebut diizinkan peran, gunakan path itu.

---

## 7. Lapisan Data

### 7.1 Kontrak `api.ts`

Setiap fungsi di `api.ts` mengembalikan `Promise<Result<T>>`, bukan melempar error.

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

type AppError = {
  code: string;        // kode dari bagian 11 spesifikasi baseline, atau 'UNKNOWN'
  message: string;     // teks dari strings/id.ts, sudah diterjemahkan
  retryable: boolean;
  raw?: unknown;       // hanya untuk logger, tidak pernah dirender
};
```

`shared/lib/errors.ts` menerjemahkan:
- `error.message` dari PostgreSQL (kode error seperti `SHIFT_NOT_OPEN`) ke `AppError`.
- Status HTTP dari endpoint staff ke `AppError`.
- Error jaringan (`TypeError: Failed to fetch`) ke `NETWORK_OFFLINE`.
- Timeout (`AbortError`) ke `REQUEST_TIMEOUT`.
- Kode yang tidak dikenal ke `UNKNOWN` dan dicatat ke Sentry.

`retryable = true` hanya untuk `NETWORK_OFFLINE`, `REQUEST_TIMEOUT`, dan `UNKNOWN` 5xx.

### 7.2 Timeout dan koneksi

- Setiap request memakai `AbortSignal.timeout(15000)`.
- Jika timeout pada mutasi uang (`create_order`, `submit_payment`, `close_open_bill`, `cancel_order`, `return_completed_order`), UI menampilkan: "Koneksi lambat. Status transaksi belum diketahui. Periksa Riwayat sebelum mencoba lagi." Tombol coba lagi memakai `client_ref` yang sama (A1). Jika server menolak karena sudah ada, UI menampilkan hasil transaksi tersebut, bukan error.
- `navigator.onLine` dan event `online`/`offline` memperbarui `connectionStore`. Saat offline, tombol yang memanggil RPC dinonaktifkan dan `OfflineBanner` tampil di atas konten.

### 7.3 Query key dan tabel invalidasi

| Query key | Isi | Diinvalidasi oleh |
|---|---|---|
| `['session']` | profil dan peran | sign in, sign out, `set_staff_role` (diri sendiri tidak diizinkan, tetap dipantau) |
| `['settings']` | `store_settings` | `update_store_settings` |
| `['payment-accounts']` | rekening | `upsert_payment_account`, `set_payment_account_active` |
| `['shift', 'active']` | shift terbuka | `open_shift`, `close_shift` |
| `['shift', 'history']` | daftar shift | `close_shift` |
| `['menu', 'categories']` | kategori | `upsert_category` |
| `['menu', 'items']` | menu dan modifier | `upsert_menu_item`, `set_menu_item_available`, `upsert_recipe` |
| `['orders', filter]` | daftar pesanan | aksi apa pun pada pesanan, realtime `orders` |
| `['order', orderId]` | detail pesanan | aksi pada pesanan tersebut, realtime |
| `['open-bills']` | daftar open bill | `create_order` (bill), `close_open_bill`, `cancel_order` |
| `['payments', 'pending']` | antrian verifikasi | `submit_payment`, `verify_payment`, realtime `payments` |
| `['history', filter]` | riwayat | semua penulisan transaksi |
| `['inventory', 'items']` | bahan | `record_stock_movement`, `upsert_inventory_item`, transaksi yang memakai stok |
| `['inventory', 'movements', itemId]` | ledger | `record_stock_movement`, transaksi, opname |
| `['opnames']` | daftar opname | `open_stock_opname`, `finalize_stock_opname` |
| `['opname', opnameId]` | detail opname | `save_stock_opname_count`, `finalize_stock_opname` |
| `['vouchers', filter]` | daftar voucher | `upsert_voucher`, `set_voucher_active`, transaksi yang memakai voucher |
| `['report', from, to]` | laporan | semua penulisan transaksi (refetch saat fokus) |
| `['staff']` | daftar staff | endpoint create-staff, `set_staff_role`, `set_staff_active` |
| `['audit', filter]` | audit log | (tidak diinvalidasi, hanya saat fokus) |

Setiap mutasi wajib mendefinisikan `invalidate` secara eksplisit sesuai tabel ini.

### 7.4 Pola mutasi

```ts
// features/pos/hooks.ts (contoh pola)
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.createOrder(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['shift', 'active'] });
      qc.invalidateQueries({ queryKey: ['open-bills'] });
    },
  });
}
```

- `mutationFn` selalu memanggil `api.*` yang mengembalikan `Result`. Jika `ok: false`, lempar `AppError` agar `onError` menangani.
- Setiap form mutasi menampilkan error di tempat, bukan hanya toast.

### 7.5 Realtime

- Hanya dua subscription: `orders` (filter: `status=in.(new,processing,ready)`) dan `payments` (filter: `status=eq.pending_verification`).
- Event memicu `invalidateQueries`, bukan membaca payload.
- Dibersihkan dengan `supabase.removeChannel`. Dilarang `unsubscribe` tanpa remove.
- Status koneksi realtime (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`) disimpan di `connectionStore` dan ditampilkan di header.
- Jika realtime tidak tersambung, halaman tetap memakai refetch saat fokus dan polling tiap 30 detik di layar Pesanan dan Verifikasi.

---

## 8. State Lokal (Zustand)

### 8.1 cartStore

```ts
type CartLine = {
  lineId: string;               // UUID dibuat klien, untuk key React
  menuItemId: string;
  name: string;                 // snapshot untuk tampilan
  unitPrice: number;            // snapshot untuk pratinjau
  modifierOptionIds: string[];
  modifierLabels: string[];     // snapshot untuk tampilan
  qty: number;                  // 1..100
  note: string | null;          // maks 140 karakter
};

type CartState = {
  orderType: 'dine_in' | 'takeaway';
  tableLabel: string | null;     // maks 30 karakter
  customerName: string | null;   // maks 60 karakter
  lines: CartLine[];
  voucherCode: string | null;
  clientRef: string | null;      // UUID untuk percobaan checkout aktif (A1)
  addLine(...): void;
  updateQty(lineId: string, qty: number): void;
  removeLine(lineId: string): void;
  setVoucher(code: string | null): void;
  clear(): void;
};
```

- Persist key `jokger.cart.v1`, `version: 1`.
- Dua baris dengan `menuItemId`, `modifierOptionIds` (urut), dan `note` yang sama digabung dengan menaikkan `qty`.
- `clientRef` dibuat saat tombol checkout pertama kali ditekan dan disimpan di cart. Dihapus saat pesanan berhasil atau keranjang dikosongkan.

### 8.2 deviceStore

```ts
type DeviceState = {
  printer: { id: string; name: string } | null;
  paperWidthOverride: 58 | 80 | null;     // null = pakai pengaturan toko (D9)
  shortcutsEnabled: boolean;              // default true
  soundOnNewOrder: boolean;               // default false
};
```

Persist key `jokger.device.v1`, `version: 1`. Tidak ada data transaksi di sini.

### 8.3 themeStore

```ts
type ThemeState = { mode: 'light' | 'dark' | 'system' };
```

Persist key `jokger.theme.v1`. Mode `system` mengikuti `prefers-color-scheme`.

### 8.4 connectionStore (memori, tidak dipersist)

```ts
type ConnectionState = {
  online: boolean;
  realtime: 'connecting' | 'connected' | 'degraded';
  printer: 'none' | 'connected' | 'disconnected' | 'unsupported';
};
```

### 8.5 Yang tidak boleh di store

- Data server (pesanan, menu, shift). Semua di TanStack Query.
- Token sesi. Dikelola supabase-js.
- Hasil RPC.

### 8.6 Lockout login

Hanya di `localStorage` dengan key `jokger.auth.lockout.v1`, berisi `{ failures: number, until: number | null }`. Bukan data sensitif. Setelah 5 kegagalan, `until = now + 30000`. Nilai ini hanya UX, dan dibaca ulang saat halaman dimuat.

---

## 9. Form

### 9.1 Pola

- React Hook Form dengan `zodResolver(schema)`.
- Skema dari `features/*/schemas.ts`. Skema yang sama dipakai untuk validasi sebelum `api` memanggil RPC.
- `mode: 'onBlur'` untuk field teks. `mode: 'onChange'` untuk field numerik dan kode voucher (uppercase otomatis).
- Submit pertama kali yang gagal memfokuskan field pertama yang salah.
- Error di bawah field dengan `aria-describedby` dan `aria-invalid`.
- Error dari server (`AppError.code`) yang terkait field dipetakan ke field tersebut. Error umum ditampilkan di bagian atas form.

### 9.2 Komponen field

Setiap field memakai `FormField` yang berisi label (selalu terlihat), deskripsi opsional, pesan error, dan input.

| Komponen | Perilaku |
|---|---|
| `TextField` | Maks panjang tampil dengan penghitung jika ada batas |
| `MoneyField` | Hanya digit, format ribuan saat blur, `inputMode="numeric"`, nilai disimpan sebagai integer |
| `QuantityField` | Tombol `−` dan `+` 44 px, rentang 1–100 |
| `PhoneField` | `inputMode="tel"`, hanya digit dan `+` |
| `AccountNumberField` | Hanya digit, tanpa spasi |
| `SelectField` | Native select untuk ≤ 7 pilihan, `Combobox` untuk lebih banyak |
| `DateRangeField` | Preset: hari ini, kemarin, 7 hari, bulan ini, bulan lalu, kustom |
| `ColorField` | Input hex, pratinjau, rasio kontras, status lulus atau gagal |
| `ImageField` | Pilih file, validasi tipe dan ukuran, pratinjau, hapus |
| `FileProofField` | Sama seperti `ImageField` dengan batas 5 MB, JPG, PNG, WEBP |

### 9.3 Perlindungan perubahan belum disimpan

- `useUnsavedChanges(isDirty)` memasang `useBlocker` dari React Router dan `beforeunload`.
- Dialog: "Ada perubahan yang belum disimpan. Tinggalkan halaman ini?" dengan tombol "Tetap di halaman" (fokus awal) dan "Tinggalkan".

### 9.4 Aturan nilai uang di form

- Input uang dikonversi ke integer sebelum divalidasi. Desimal ditolak.
- Batas input uang: 0 sampai 999.999.999 rupiah, kecuali pembayaran tunai (sampai 999.999.999).
- Nilai 0 ditolak untuk pembayaran dan harga, dan diizinkan untuk minimum belanja voucher.

---

## 10. Sistem Desain

### 10.1 Token warna

Semua warna didefinisikan sebagai CSS custom properties di `:root` (terang) dan `.dark` (gelap). Tailwind memakai `var(--token)`.

| Token | Terang | Gelap | Fungsi |
|---|---|---|---|
| `--bg` | `#FAF7F3` | `#17120E` | Latar halaman |
| `--surface` | `#FFFFFF` | `#221B16` | Kartu, panel |
| `--surface-raised` | `#FFFFFF` | `#2B231D` | Modal, dropdown |
| `--border` | `#E7DED4` | `#3A3029` | Garis |
| `--text` | `#1F1813` | `#F3ECE4` | Teks utama |
| `--text-muted` | `#6B5D52` | `#B5A89B` | Teks sekunder |
| `--brand` | dari store | dari store | Tombol primer |
| `--brand-hover` | turunan | turunan | Hover |
| `--brand-contrast` | otomatis | otomatis | Teks di atas brand |
| `--accent` | dari store | dari store | Latar lembut |
| `--success` | `#2E7D4F` | `#4CAF7A` | Selesai, terverifikasi |
| `--warning` | `#B26A00` | `#E0A030` | Menunggu, menipis |
| `--danger` | `#B42318` | `#F87171` | Void, batal, selisih |
| `--info` | `#1D5FA8` | `#60A5FA` | Diproses |
| `--focus` | `--brand` | `--brand` | Ring fokus |

### 10.2 Turunan brand dan kontras

- `--brand-contrast` memilih `#1B1410` atau `#FFFFFF` berdasarkan luminansi `--brand` (rumus dari `shared/lib/contrast.ts`).
- `--brand-hover`: 8% lebih gelap untuk terang, 8% lebih terang untuk gelap.
- Validasi kontras WCAG AA dijalankan sebelum simpan:
  - Teks normal: rasio minimal 4,5:1.
  - Teks besar (≥ 24 px atau ≥ 18,66 px tebal): minimal 3:1.
  - Pasangan yang diperiksa: `--brand` vs `--brand-contrast`, `--accent` vs `--text`, `--bg` vs `--text`, `--surface` vs `--text-muted`.
- Gagal validasi: tombol Simpan nonaktif dan pesan `CONTRAST_TOO_LOW` ditampilkan di field warna terkait.

### 10.3 Status (wajib ikon dan teks)

| Status | Label | Warna | Ikon |
|---|---|---|---|
| new | Baru | info | circle-dot |
| processing | Diproses | warning | flame |
| ready | Menunggu diambil | brand | bell |
| completed | Selesai | success | check |
| cancelled | Dibatalkan | danger | x |
| pending_verification | Menunggu verifikasi | warning | clock |
| verified | Terverifikasi | success | badge-check |
| rejected | Ditolak | danger | ban |
| open (shift) | Kasir terbuka | success | unlock |
| closed (shift) | Kasir tertutup | muted | lock |

Label status diambil dari `strings/id.ts`. Di dalam tabel, badge status dan teks diberi `aria-label` yang lengkap.

### 10.4 Tipografi

| Peran | Ukuran | Berat | Tinggi baris |
|---|---|---|---|
| Judul halaman (`h1`) | 24 px (mobile 20 px) | 700 | 1,25 |
| Judul panel (`h2`) | 18 px | 600 | 1,3 |
| Label tombol | 15 px (POS 18 px) | 600 | 1,2 |
| Isi | 15 px | 400 | 1,5 |
| Metadata, caption | 13 px | 500 | 1,4 |
| Total besar POS | 32 px | 700 | 1,1 |

- Font default `Inter`. Pilihan lain dari branding: `Plus Jakarta Sans`, `Poppins`, `system-ui`.
- Setiap angka uang dan nomor pesanan memakai `font-variant-numeric: tabular-nums`.
- Ukuran teks minimum 13 px. Dilarang di bawah itu.

### 10.5 Spasi, radius, elevasi, z-index

- Skala spasi: 4, 8, 12, 16, 24, 32, 48 px. Tidak ada nilai di luar skala.
- Radius: kontrol 10 px, kartu 14 px, modal 18 px, badge 999 px.
- Elevasi: `shadow-sm` untuk kartu, `shadow-lg` untuk drawer dan modal. Di mode gelap, elevasi diwakili perbedaan `--surface` dan `--surface-raised`.
- Z-index: header 40, sidebar 30, bottom nav 40, drawer 50, modal 60, toast 70, banner koneksi 80.

### 10.6 Gerak

- Mikro-interaksi 150 ms, modal dan drawer 220 ms. Easing `ease-out` masuk, `ease-in` keluar.
- Dengan `prefers-reduced-motion: reduce`, durasi menjadi 0 dan tidak ada animasi berulang.
- Tidak ada animasi di alur uang yang melebihi 300 ms.

### 10.7 Ikon

- `lucide-react`, ukuran 16, 20, 24 px. Diimpor per nama.
- Ikon berdiri sendiri wajib `aria-label`. Ikon dekoratif wajib `aria-hidden="true"`.

### 10.8 Tema

- `themeStore.mode` menentukan kelas `dark` pada `<html>`.
- Logo: jika `logo_url` tidak menampilkan kontras di tema gelap, sistem memberi latar `--surface-raised` di belakang logo. Ini dicek dengan atribut `data-logo-bg`.

---

## 11. Komponen

### 11.1 `shared/ui` (primitif)

Berisi komponen shadcn yang sudah disalin dan disesuaikan dengan token di atas:

Button, IconButton, Input, Label, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, Dialog, AlertDialog, Sheet, DropdownMenu, Tabs, Tooltip, Popover, Table, Badge, Card, Skeleton, Separator, Calendar, Toaster (Sonner), Progress, Spinner.

Aturan untuk semua primitif:
- Tinggi interaktif minimal 44 px pada POS dan 40 px di layar lain. Pada mobile semua target minimal 44 px.
- Varian yang wajib: default, secondary, ghost, danger untuk Button. Status loading menggantikan label dengan spinner, lebar tombol tetap, dan `aria-busy="true"`.
- `disabled` memakai `aria-disabled` dan tidak menghilangkan fokus, kecuali pada tombol yang memanggil RPC yang sedang berjalan.

### 11.2 `shared/components` (komponen aplikasi)

| Komponen | Props utama | Perilaku |
|---|---|---|
| `Money` | `value: number`, `tone?: 'default' \| 'danger' \| 'success'`, `signed?: boolean` | Format `Intl.NumberFormat('id-ID', …)`. Nilai negatif memakai tanda minus dan tone danger jika `signed`. |
| `StatusBadge` | `kind: 'order' \| 'payment' \| 'shift'`, `status` | Dari tabel 10.3 |
| `DataTable` | `columns`, `rows`, `getRowId`, `sort`, `selection`, `empty`, `loading` | Header sticky. Di bawah 768 px berubah menjadi daftar kartu dengan kolom utama dan detail. |
| `ConfirmAction` | `title`, `description`, `confirmLabel`, `tone`, `requireReason?`, `requireTypedText?`, `onConfirm` | Tombol destruktif tidak fokus awal. Tombol konfirmasi nonaktif sampai alasan atau teks yang diketik sesuai. |
| `NumericKeypad` | `onKey`, `onBackspace`, `onClear` | Untuk input uang di tablet. Target 56 px. |
| `QuickCash` | `total`, `onPick` | Tombol: uang pas, dan pembulatan ke 10.000, 50.000, 100.000 berikutnya di atas total. |
| `OfflineBanner` | - | Tampil saat `online = false` |
| `RealtimeBadge` | - | Titik status dan teks "Langsung" atau "Muat ulang otomatis" |
| `PrinterStatus` | - | Ikon dan teks status printer |
| `ShiftBadge` | - | Status shift dan jam buka |
| `EmptyState` | `icon`, `title`, `description`, `action?` | Satu aksi maksimal |
| `ErrorState` | `error: AppError`, `onRetry?` | Pesan dari `AppError.message` dan tombol coba lagi jika `retryable` |
| `SearchInput` | `value`, `onChange`, `placeholder` | Debounce 250 ms, tombol hapus saat ada isi, `type="search"` |
| `Pagination` | `page`, `pageSize`, `total`, `onChange` | Pilihan 25, 50, 100 |
| `KeyboardHint` | `keys` | Ditampilkan di tooltip dan bar bawah POS |
| `PageHeader` | `title`, `description?`, `actions?` | Satu `h1` |
| `SectionCard` | `title`, `children`, `actions?` | Kartu dengan `h2` |
| `Stat` | `label`, `value`, `hint?` | Kartu ringkasan |
| `Chart` | `kind: 'bar' \| 'line'`, `series`, `labels`, `formatValue` | SVG sederhana, selalu disertai `DataTable` tersembunyi visual dengan tombol unduh CSV |

### 11.3 Komponen yang dilarang dibuat ulang

Jika sudah ada di `shared/`, dilarang membuat versi lokal di fitur. Contoh: tabel, badge status, dialog konfirmasi, input uang.

---

## 12. Pola Umum UI

### 12.1 Loading

- Daftar: skeleton baris sesuai jumlah kolom (6 baris default).
- Ringkasan angka: `—` (em dash) dengan `aria-busy="true"`. Dilarang menampilkan `0` saat memuat.
- Tombol aksi: spinner di dalam tombol, lebar tetap, tombol nonaktif.
- Halaman penuh: skeleton layout, bukan spinner di tengah layar kosong.
- Loading lebih dari 300 ms baru ditampilkan (hindari kedipan).

### 12.2 Kosong

- Setiap daftar punya pesan kosong spesifik dari `strings/id.ts`.
- Jika kosong karena filter, tampilkan "Tidak ada hasil untuk filter ini" dan tombol Reset filter.
- Jika kosong karena belum ada data, tampilkan satu aksi relevan (misalnya "Tambah menu").

### 12.3 Error

- Error query: `ErrorState` di tempat data seharusnya tampil, dengan tombol coba lagi.
- Error mutasi: pesan di tempat (form atau dialog), dan toast error dengan durasi 6 detik. Toast error tidak hilang otomatis jika mengandung kode yang butuh tindakan (misalnya harga berubah).
- Error otorisasi: sign out dan redirect ke `/login`, dengan pesan.

### 12.4 Toast

| Jenis | Durasi | Live region |
|---|---|---|
| success | 4 detik | `polite` |
| info | 4 detik | `polite` |
| warning | 6 detik | `polite` |
| error | 6 detik, atau manual dismiss jika ada aksi | `assertive` |

- Maksimal 3 toast terlihat.
- Toast punya tombol tutup dan, jika relevan, satu aksi (misalnya "Coba lagi", "Undo").
- Toast tidak pernah menjadi satu-satunya tempat informasi penting. Setiap hasil penting juga terlihat di layar.

### 12.5 Konfirmasi dan alasan

| Aksi | Konfirmasi | Alasan | Ketik teks |
|---|---|---|---|
| Hapus baris keranjang | Tidak, ada undo 5 detik | Tidak | Tidak |
| Kosongkan keranjang | Ya | Tidak | Tidak |
| Void item | Ya | Ya | Tidak |
| Batalkan pesanan | Ya | Ya | Tidak |
| Retur pesanan selesai | Ya | Ya | Ya, nomor pesanan |
| Tolak pembayaran | Ya | Ya | Tidak |
| Tutup kasir | Ya, dua langkah | Tidak | Tidak |
| Finalisasi opname | Ya | Tidak | Ya, `FINALISASI` |
| Stok negatif | Ya | Ya | Ya, nama bahan |
| Nonaktifkan staff, voucher, rekening, menu | Ya | Tidak | Tidak |
| Ubah peran staff | Ya | Tidak | Tidak |
| Keluar dengan keranjang berisi | Ya | Tidak | Tidak |

Alasan wajib memiliki minimal 3 karakter dan maksimal 200 karakter. Teks alasan tidak boleh kosong setelah trim.

### 12.6 Uang dan jumlah besar

- Nominal tunai di atas 10 kali total memunculkan konfirmasi "Pastikan nominal benar: Rp X?".
- Pembayaran di atas Rp 5.000.000 untuk tunai memunculkan konfirmasi kedua.

---

## 13. Format

### 13.1 Aturan format (`shared/lib/format.ts`)

| Jenis | Format | Contoh |
|---|---|---|
| Rupiah | `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })` | Rp 12.500 |
| Angka biasa | `id-ID` | 1.234 |
| Persen | `id-ID`, maksimal 2 desimal | 10,5% |
| Tanggal | `d MMM yyyy` | 8 Okt 2026 |
| Tanggal dan jam | `d MMM yyyy, HH:mm` | 8 Okt 2026, 09:58 |
| Jam | `HH:mm` | 09:58 |
| Durasi sejak waktu | "5 menit", "1 jam 20 menit" | |
| Nomor pesanan | apa adanya | JKG-20261008-0001 |
| Nomor rekening (daftar) | 4 digit terakhir | •••• 1234 |
| Nomor rekening (detail) | lengkap, dikelompokkan 4 digit | 1234 5678 9012 |

Semua tanggal dan jam ditampilkan dalam zona `Asia/Jakarta` menggunakan `Intl.DateTimeFormat` dengan `timeZone: 'Asia/Jakarta'`, bukan zona perangkat.

### 13.2 Input

- Input uang: pengguna mengetik digit, tampilan diformat ribuan saat blur. Nilai yang dikirim adalah integer.
- Input nomor: hanya digit, tanpa spasi atau pemisah.

---

## 14. Tata Letak Umum

### 14.1 AppShell

- Header (tinggi 56 px desktop, 52 px mobile): logo dan nama toko (kiri), indikator shift, indikator koneksi, indikator printer (tampil di layar POS dan pengaturan printer), nama staff dan peran, menu profil (tema, keluar).
- Sidebar (≥1024 px): lebar 240 px, dapat diciutkan ke 72 px (hanya ikon dengan tooltip). Status ciut disimpan di `localStorage` sebagai preferensi UI (`jokger.ui.sidebar.v1`).
- Bottom navigation (<768 px): lima item: POS, Pesanan, Shift, Stok, Lainnya. "Lainnya" membuka sheet berisi sisa menu.
- Area tablet (768–1023 px): bottom navigation dengan label, sidebar disembunyikan.
- Skip link "Lewati ke konten utama" sebagai elemen pertama.
- Landmark: `header`, `nav`, `main`, `aside`.

### 14.2 Grup menu sidebar

| Grup | Item | Peran |
|---|---|---|
| Operasional | Kasir (POS), Pesanan, Riwayat, Shift | staff |
| Katalog | Menu, Voucher | staff |
| Stok | Inventaris, Stok opname | staff |
| Pembayaran | Rekening, Verifikasi | staff |
| Laporan | Laporan | staff |
| Pengaturan | Toko dan branding, Staff, Printer, Audit | super_admin untuk toko, branding, staff, audit. Printer untuk staff. |

Item yang tidak diizinkan peran tidak ditampilkan. Grup kosong tidak ditampilkan.

### 14.3 Badge jumlah

- Pesanan: jumlah status `new` dan `processing`.
- Verifikasi: jumlah `pending_verification`.
- Inventaris: jumlah bahan dengan `current_qty <= min_qty`.
- Badge menggunakan teks dan `aria-label` yang menyebut jumlah lengkap, misalnya "Pesanan, 3 aktif".

### 14.4 Header indikator

- Shift: "Kasir terbuka sejak 08.00" atau "Kasir tertutup". Klik menuju `/shift`.
- Koneksi: ikon dan teks "Online", "Offline", atau "Realtime terputus".
- Printer: "Printer terhubung", "Printer tidak terhubung", atau "Printer tidak didukung di browser ini".

---

## 15. Layar

Setiap layar dijelaskan dengan: tujuan, aksi utama, tata letak, komponen, state, interaksi, validasi, dan error.

### 15.1 Login (`/login`)

- **Tujuan:** masuk ke sistem.
- **Tata letak:** kartu tengah maksimal 400 px. Logo dan nama toko dari `store_settings`. Jika `store_settings` gagal dimuat, tampilkan nama "JOKGER" tanpa logo.
- **Komponen:** email, password (dengan tombol tampilkan), Masuk, tautan "Lupa password" (memanggil `resetPasswordForEmail`, pesan netral).
- **Validasi:** email format, password tidak kosong. Password minimal 10 karakter tidak diperiksa di login (hanya saat ubah password).
- **Error:** "Email atau password salah." untuk semua kegagalan autentikasi (tidak membedakan akun ada atau tidak).
- **Lockout:** setelah 5 kegagalan, tombol nonaktif 30 detik dengan hitung mundur "Coba lagi dalam 27 detik" dalam live region setiap 5 detik.
- **Akun nonaktif:** pesan "Akun Anda tidak aktif. Hubungi pemilik."
- **Fokus awal:** field email.

### 15.2 Kasir / POS (`/pos`)

Layar paling kritis. Dirancang untuk tablet landscape 1024×768 ke atas.

**Tujuan:** membuat pesanan dan menerima pembayaran secepat mungkin.

**Tata letak (≥1024 px):**

```
┌─────────────────────────────────────────────────────────────┐
│ Header (shift, koneksi, printer, staff)                      │
├──────────────────────────────────┬──────────────────────────┤
│ Tab kategori (horizontal scroll) │ Keranjang                │
│ Pencarian menu                   │ Jenis: Dine-in | Takeaway│
│                                  │ Meja/Pelanggan           │
│ Grid kartu menu                  │ ─────────────────        │
│  3 kolom (tablet), 4 (≥1280 px)  │ Baris item               │
│                                  │ ...                      │
│                                  │ ─────────────────        │
│                                  │ Voucher [kode] [Terapkan]│
│                                  │ Subtotal, diskon,        │
│                                  │ layanan, pajak,          │
│                                  │ pembulatan               │
│                                  │ TOTAL                    │
│                                  │ [Kosongkan] [Bayar] [Bill]│
└──────────────────────────────────┴──────────────────────────┘
│ Bar pintasan: / cari · 1–9 pilih · F2 bayar · F3 bill · F4 voucher │
```

**Tata letak (768–1023 px):** keranjang sempit (320 px) di kanan.

**Tata letak (<768 px atau potret):** grid penuh. Keranjang menjadi bottom sheet dengan ringkasan (jumlah item dan total) di atas bottom navigation. Ketuk membuka sheet penuh. Di potret tablet (768–1023 px), tampilkan banner kecil "Putar perangkat ke landscape untuk pengalaman terbaik" yang bisa ditutup.

**Panel menu:**
- Tab kategori: horizontal, bisa digeser, kategori aktif dengan garis brand dan `aria-selected`. Kategori kosong (tidak ada item aktif) disembunyikan.
- Pencarian: memfilter semua kategori. Hasil menggantikan grid dengan judul "Hasil pencarian: N item". Tombol Esc menghapus pencarian.
- Kartu menu: gambar rasio 4:3 (`loading="lazy"`, dimensi eksplisit), nama (maks 2 baris), harga, badge "Habis" jika `is_available = false`. Item habis tampil redup, `aria-disabled`, tidak bisa dipilih.
- Ketuk kartu: jika tidak ada modifier, tambah 1 porsi langsung. Jika ada modifier, buka panel modifier.
- Panel modifier (drawer): daftar grup. Setiap grup menampilkan aturan ("Pilih 1" atau "Pilih 0 sampai 3"). Tombol "Tambah" nonaktif sampai semua grup memenuhi `min_select` dan tidak melebihi `max_select`. Catatan opsional (maks 140 karakter). Jumlah dengan `QuantityField`.
- Tahan kartu 500 ms atau tombol ikon kecil di kartu membuka panel modifier untuk mengatur jumlah dan catatan tanpa menambah langsung.

**Panel keranjang:**
- Jenis pesanan: segmented control (Dine-in, Takeaway). Default Dine-in.
- Meja atau pelanggan: input teks opsional.
- Baris item: nama, modifier (dipisah koma), catatan (dengan ikon jika ada), `QuantityField` (44 px), total baris `Money`, tombol hapus (ikon sampah). Di mobile, geser ke kiri membuka tombol Hapus. Hapus memicu toast undo 5 detik, bukan konfirmasi.
- Voucher: input kode (uppercase otomatis, maks 32 karakter), tombol Terapkan. Setelah berhasil, chip "KODE · −Rp 5.000" dengan tombol hapus. Pesan hasil validasi lokal ditampilkan di bawah input. Validasi final di server saat checkout.
- Ringkasan: subtotal, diskon voucher (dengan kode), layanan (jika >0), pajak (jika >0), pembulatan (jika ≠0), total besar. Angka dihitung `calculateTotals` yang sama dengan server (bagian 13.3.1).
- Tombol: Kosongkan (ghost, dengan konfirmasi), Bayar (primer, F2), Open bill (sekunder, F3).
- Bila keranjang kosong: tombol Bayar dan Open bill nonaktif, dengan pesan "Tambahkan menu untuk memulai".

**Pembayaran (drawer dari kanan di desktop, sheet penuh di mobile):**

1. **Pilih metode.** Empat tombol besar: Tunai, Transfer, E-wallet, Split. Default Tunai.
2. **Tunai.**
   - Total besar di atas.
   - Input "Uang diterima" dengan `NumericKeypad` dan `QuickCash`.
   - Kembalian besar, berubah menjadi "Kurang Rp X" dengan `--danger` jika uang kurang.
   - Tombol "Selesai & Cetak" aktif hanya jika uang diterima ≥ total.
   - Konfirmasi "Pastikan nominal benar" sesuai 12.6.
3. **Transfer dan E-wallet.**
   - Daftar rekening aktif dari `['payment-accounts']`, sebagai kartu radio. Jika tidak ada rekening aktif, tampilkan "Belum ada rekening aktif. Tambahkan di Pembayaran → Rekening." dan nonaktifkan metode ini.
   - Setelah dipilih: nomor lengkap dengan tombol Salin (menggunakan `navigator.clipboard`, toast "Nomor disalin").
   - Input nomor referensi (wajib, 4 sampai 40 karakter, huruf dan angka).
   - Unggah bukti (opsional, dianjurkan): `FileProofField` 5 MB, JPG, PNG, WEBP. Validasi di klien. Unggah ke `payment-proofs` dengan path `YYYY/MM/DD/<order_id>-<uuid>.<ext>`.
   - Tombol "Kirim untuk verifikasi". Status pesanan tetap dibuat, pembayaran berstatus `pending_verification`.
   - Jika unggah gagal, pembayaran tetap dikirim tanpa bukti dengan catatan "Bukti belum dilampirkan" (sesuai baseline).
4. **Split.**
   - Daftar baris pembayaran. Setiap baris: metode (select), nominal (`MoneyField`), dan untuk tunai `received_amount`, untuk non-tunai rekening dan referensi.
   - Sisa tagihan (`Sisa Rp X`) tampil terus di atas daftar. Berubah warna ke `--success` saat 0.
   - Tombol Tambah baris. Tombol Selesai nonaktif sampai jumlah baris = total.
5. **Checkout.** Semua metode memakai tombol primer yang sama di bagian bawah drawer. Saat diklik:
   - Jika `clientRef` kosong, buat UUID dan simpan ke cart.
   - Panggil `create_order` dengan `p_client_ref` (A1), `p_items` dari keranjang, `p_voucher_code`, `p_payments` sesuai total pratinjau.
   - Tombol nonaktif dan menampilkan spinner selama request. Klik ganda diabaikan.
6. **Hasil sukses.** Layar sukses di dalam drawer:
   - Nomor pesanan besar.
   - Total dan kembalian (jika tunai).
   - Tombol: Pesanan baru (fokus awal, memanggil `cart.clear()`), Cetak ulang (memanggil cetak, lihat bagian 15.2.9), Lihat pesanan.
   - Keranjang dihapus setelah sukses.
7. **Hasil gagal.**
   - `PAYMENT_EXCEEDS_OUTSTANDING` atau `CASH_RECEIVED_INSUFFICIENT` (A3): pesan "Harga menu berubah. Keranjang diperbarui, periksa total baru." Invalidate `['menu', 'items']`. Keranjang tetap, harga pratinjau diperbarui sesuai menu terbaru, drawer kembali ke pilihan metode.
   - Stok tidak cukup: pesan "Stok [nama bahan] tidak cukup. Kurangi jumlah atau ubah resep." Item yang bermasalah disorot di keranjang jika `STOCK_INSUFFICIENT` menyebut item.
   - Menu habis: item dihapus dari keranjang dengan toast "Item [nama] sudah habis dan dihapus dari keranjang."
   - Voucher tidak valid: voucher dilepas dari keranjang dengan pesan dari `AppError`.
   - Timeout: sesuai 7.2. `clientRef` dipertahankan.
   - Keranjang tidak pernah dihapus saat gagal.

**Pembuatan struk dan cetak:**
- Setelah sukses, jika printer terhubung dan `deviceStore.printer` ada, struk dikirim otomatis. Jika tidak, struk masuk antrian dengan toast "Struk disimpan di antrian cetak."
- Pencetakan dijalankan setelah pesanan tersimpan. Kegagalan cetak tidak mengubah status pesanan.

**Pintasan keyboard (aktif jika `deviceStore.shortcutsEnabled`):**

| Tombol | Aksi | Syarat |
|---|---|---|
| `/` | Fokus pencarian menu | Tidak sedang di input |
| `1`–`9` | Pilih item ke-n dari grid yang terlihat (tambah satu porsi atau buka modifier) | Tidak sedang di input |
| `+` / `-` | Ubah jumlah baris keranjang yang terpilih | Baris terpilih dengan panah atas/bawah |
| `↑` / `↓` | Pindah baris keranjang | Fokus di keranjang |
| `Delete` | Hapus baris terpilih (dengan undo) | Fokus di keranjang |
| `F2` | Buka pembayaran | Keranjang tidak kosong |
| `F3` | Buka open bill | Keranjang tidak kosong |
| `F4` | Fokus input voucher | Selalu |
| `Esc` | Tutup drawer atau hapus pencarian | Selalu |
| `?` | Buka daftar pintasan | Tidak sedang di input |

Pintasan tidak aktif saat fokus di input teks, kecuali `F2`, `F3`, `F4`, dan `Esc`. Setiap pintasan terlihat di `KeyboardHint`.

**Akses printer dari POS:** status printer di header. Ketuk membuka `/settings/printer`.

**Waktu respons:** aksi keranjang (tambah, ubah jumlah, hapus) berubah seketika di state lokal. Tidak menunggu server.

**Pemulihan:** jika halaman dimuat ulang saat drawer pembayaran terbuka, drawer tertutup. Keranjang tetap ada, `clientRef` tetap ada. Jika pesanan sempat terbuat, pengguna melihat hasilnya di Riwayat, bukan membuat ulang.

### 15.3 Open bill (`/pos/open-bill/:orderId`)

- **Tujuan:** menambah item bertahap dan menutup tagihan di akhir.
- **Tata letak:** sama dengan POS. Kiri menu dengan tombol "Tambah ke bill". Kanan panel "Bill" dengan header: nomor pesanan, meja atau pelanggan, waktu buka (`Dibuka 08.15`), total sementara.
- **Panel bill:** item dikelompokkan per waktu penambahan dengan subjudul "Ditambahkan 09.12". Item yang sudah dikirim ke dapur (sudah ada di status `processing` atau lebih) ditandai "Dikirim".
- **Tambah item:** memanggil `add_items_to_open_bill` dengan `client_ref` (A1). Berhasil: panel bill diperbarui. Item baru diberi sorot singkat 1,5 detik (dihormati reduced motion).
- **Void item:** hanya tombol void per item, memakai `ConfirmAction` dengan alasan wajib.
- **Tutup bill:** tombol primer memunculkan drawer pembayaran (sama dengan POS: metode, split, voucher opsional). Panggil `close_open_bill` dengan `client_ref`.
- **Setelah tutup:** halaman berubah menjadi tampilan baca saja, banner "Bill sudah ditutup" tampil, tombol tambah dan void hilang. Tombol Cetak struk aktif.
- **Bill terbuka di shift lain:** jika shift sudah ditutup, halaman menampilkan banner "Shift ini sudah ditutup. Bill tidak bisa diubah." Tidak ada aksi.
- **Error `BILL_CLOSED`:** pesan "Bill sudah ditutup oleh kasir lain." lalu muat ulang data.

### 15.4 Pesanan (`/orders`)

- **Tujuan:** memantau dan menggerakkan pesanan aktif.
- **Header:** judul, `RealtimeBadge`, tombol Muat ulang.
- **Tab status:** Semua, Baru, Diproses, Menunggu diambil, Selesai, Dibatalkan. Setiap tab menampilkan jumlah. Tab Selesai dan Dibatalkan menampilkan 50 terbaru, dengan tombol "Muat lebih banyak" (tanpa infinite scroll).
- **Filter:** tipe (Semua, Dine-in, Takeaway), open bill (Semua, Hanya open bill), rentang tanggal (default hari ini), kasir. Filter tersimpan di query string.
- **Desktop (≥1024 px):** papan tiga kolom: Baru, Diproses, Menunggu diambil. Setiap kolom bisa diciutkan. Kolom Selesai dan Dibatalkan hanya di tab masing-masing.
- **Mobile:** tab dengan daftar kartu.
- **Kartu pesanan:**
  - Baris 1: nomor pesanan (`font-mono`), badge status.
  - Baris 2: meja atau pelanggan, tipe, jumlah item.
  - Baris 3: waktu sejak dibuat (diperbarui tiap 60 detik), total.
  - Penanda "Menunggu lama" jika status `new` lebih dari 15 menit (ikon dan teks).
  - Badge "Open bill" jika `bill_state = 'open'`.
  - Badge "Belum lunas" jika pembayaran belum lengkap.
- **Aksi cepat di kartu:** Proses, Siap, Selesai. Hanya transisi valid (bagian 10.3 baseline). Selesai nonaktif dengan tooltip alasan jika belum lunas atau belum terverifikasi.
- **Klik kartu:** membuka detail (`/orders/:id`). Di desktop, panel samping. Di mobile, halaman penuh.
- **Realtime:** pesanan baru muncul dengan animasi singkat (dihormati reduced motion). Pengumuman untuk pembaca layar: "N pesanan baru", digabung dalam satu pengumuman per 5 detik. Suara hanya jika `soundOnNewOrder`.
- **Kosong:** "Belum ada pesanan aktif." dengan tombol "Buka kasir".

### 15.5 Detail pesanan (`/orders/:orderId`)

- **Header:** nomor pesanan, status, tipe, waktu, kasir pembuat, meja atau pelanggan.
- **Bagian item:** tabel item termasuk yang void (teks dicoret, alasan void di bawahnya, `aria-label` menyebut "dibatalkan").
- **Bagian rincian:** subtotal, diskon voucher (kode), layanan, pajak, pembulatan, total, sisa tagihan.
- **Bagian pembayaran:** tabel pembayaran dengan metode, nominal, status, referensi. Refund ditampilkan sebagai nominal negatif dengan label "Refund". Pembayaran `pending_verification` memiliki tombol "Verifikasi" yang membuka `/payment-verification?payment=<id>`.
- **Bagian riwayat status:** daftar perubahan status dari audit log, dengan waktu dan nama staff.
- **Aksi:** Cetak ulang (selalu tersedia, tanda REPRINT), Void item (jika diizinkan), Batalkan (jika `new` atau `processing`), Retur (hanya super admin, jika `completed`).
- **Aturan:** aksi destruktif memakai `ConfirmAction` sesuai 12.5.

### 15.6 Riwayat (`/history`)

- **Tujuan:** mencari dan memeriksa transaksi masa lalu.
- **Filter:** rentang tanggal dengan preset, status, metode, kasir, tipe, pencarian nomor. Filter di query string.
- **Ringkasan:** jumlah transaksi, total penjualan, rata-rata nilai, dari hasil filter. Angka diambil dari `get_sales_report` untuk rentang yang sama agar konsisten dengan laporan. Jika filter status atau kasir dipakai, ringkasan dihitung dari daftar yang sama dan ditandai "Sesuai filter".
- **Tabel:** kolom nomor, waktu, tipe, ringkasan item (dipotong dengan tooltip), metode, total, status, kasir. Baris dapat diklik.
- **Drawer detail:** sama dengan 15.5, dengan tombol Cetak ulang dan Ekspor satu transaksi (CSV).
- **Ekspor CSV:** untuk hasil filter saat ini, maksimal 5.000 baris. Jika lebih, tampilkan pesan untuk mempersempit filter.
- **Pagination:** 25 baris, pilihan 50 dan 100. Tanpa infinite scroll.
- **Mobile:** tabel menjadi kartu.

### 15.7 Shift (`/shift`)

**Tanpa shift terbuka:**
- Kartu besar "Buka kasir".
- Input saldo awal tunai (`MoneyField`, minimal 0).
- Tombol Buka kasir.
- Error `SHIFT_ALREADY_OPEN`: muat ulang dan tampilkan shift yang aktif.

**Shift terbuka:**
- Kartu status: waktu buka, saldo awal, jumlah pesanan, total per metode (tunai, transfer, e-wallet), kas yang diharapkan. Angka diperbarui saat fokus dan saat realtime `payments` berubah.
- Tombol Tutup kasir.
- Jika ada open bill, tombol nonaktif dengan teks "Tutup semua open bill terlebih dahulu" dan tautan ke daftar open bill.

**Tutup kasir (dialog dua langkah):**
- Langkah 1: ringkasan. Tombol Lanjut.
- Langkah 2: input kas fisik (`MoneyField`, minimal 0). Selisih realtime:
  - `actual < expected`: "Kurang Rp X" dengan `--danger`.
  - `actual = expected`: "Pas" dengan `--success`.
  - `actual > expected`: "Lebih Rp X" dengan `--warning`.
- Catatan opsional (maks 200 karakter), wajib jika selisih ≠ 0 (disarankan, tidak wajib di server? Baseline tidak mewajibkan; frontend mewajibkan untuk selisih ≠ 0 sebagai aturan UI dan dicatat di spec backend sebagai amandemen opsional).
- Tombol Tutup kasir. Setelah sukses, dialog menampilkan ringkasan dan tombol Cetak ringkasan, lalu redirect ke `/shift` yang kini menampilkan kartu buka kasir.

**Riwayat shift:** tabel shift sebelumnya: tanggal, buka, tutup, kasir, saldo awal, kas diharapkan, kas aktual, selisih (dengan warna dan teks), tombol cetak ringkasan.

### 15.8 Menu (`/menu`)

- **Layout:** dua kolom. Kiri: daftar kategori dengan jumlah item. Kanan: daftar item kategori terpilih.
- **Urutan:** seret dengan pegangan (`DragHandle`) atau tombol panah atas dan bawah (keyboard). Hasil disimpan lewat `upsert_category` atau `upsert_menu_item` dengan `sort_order`. Gagal: kembali ke urutan sebelumnya dengan toast.
- **Item:** nama, harga (`Money`), status Tersedia, status Aktif, indikator resep (ikon jika ada resep).
- **Toggle "Habis":** switch langsung di baris. Optimistik dengan rollback sesuai aturan 1.8.
- **Form item (dialog besar atau halaman):**
  - Nama (wajib, maks 80), deskripsi (opsional, maks 200), kategori (wajib), harga (wajib, integer ≥ 0), gambar (opsional), status aktif, status tersedia.
  - Gambar: kompresi di browser ke maks 800 px sisi terpanjang, format WEBP, lalu unggah ke `public-assets/menu/`. Batas 2 MB sebelum kompresi.
  - Modifier: pilih grup dari daftar, dengan pratinjau aturan. Buat grup baru dari dialog terpisah dengan nama, minimal, maksimal, dan opsi (nama dan harga tambahan).
  - Resep: tabel bahan dengan `inventory_item_id`, jumlah per porsi (> 0), satuan otomatis dari bahan. Tambah baris. Simpan dengan `upsert_recipe`.
- **Hapus item:** nonaktifkan dengan `ConfirmAction`. Teks: "Item disembunyikan dari kasir. Riwayat transaksi tetap tersimpan."
- **Kategori:** dialog sederhana, nonaktifkan dengan konfirmasi, tidak ada hapus.

### 15.9 Inventaris (`/inventory`)

- **Tabel bahan:** nama, satuan, stok saat ini (`tabular-nums`), stok minimum, nilai stok (`Money`, stok × harga pokok), status (Aman, Menipis, Habis).
- **Status:** Habis jika stok ≤ 0. Menipis jika stok ≤ minimum. Di tabel, status ditampilkan dengan ikon dan teks.
- **Aksi per baris (menu):** Catat pembelian, Catat waste, Penyesuaian, Riwayat, Ubah bahan.
- **Dialog pembelian:** jumlah (> 0, maksimal 3 desimal), catatan opsional. Tidak mengubah harga pokok. Harga pokok diubah lewat Ubah bahan.
- **Dialog waste:** jumlah (> 0), catatan wajib.
- **Penyesuaian:** tipe `adjustment` dengan nilai positif atau negatif, catatan wajib. Nilai negatif yang membuat stok di bawah nol ditolak dengan `STOCK_INSUFFICIENT` kecuali super admin mengaktifkan D16 (checkbox dengan peringatan dan ketik nama bahan).
- **Riwayat (drawer):** tabel ledger: waktu, jenis, jumlah (positif hijau, negatif merah dengan tanda), referensi (tautan ke pesanan atau opname jika ada), pengguna, catatan. Pagination 50 baris.
- **Ubah bahan:** nama, satuan (tetap, tidak bisa diubah setelah ada pergerakan), stok minimum, harga pokok. Stok saat ini tidak bisa diubah langsung.

### 15.10 Stok opname (`/inventory/opname`, `/inventory/opname/:opnameId`)

**Daftar:**
- Tombol "Mulai opname" (nonaktif jika ada draft, dengan teks "Opname draft sedang berjalan").
- Tabel: tanggal dibuka, dibuka oleh, status, tanggal finalisasi. Baris draft dapat diklik untuk melanjutkan.

**Detail:**
- Header: status, tanggal, pembuat, ringkasan jumlah bahan, selisih, belum dihitung.
- Tabel: nama bahan, satuan, stok sistem (baca saja, `tabular-nums`), stok hitung (`NumericInput`, desimal sampai 3 digit), selisih (otomatis, warna dan teks).
- Filter: "Hanya selisih", "Belum dihitung", cari nama.
- Keyboard: Enter pindah ke baris bawah, Shift+Enter ke atas. Tab mengikuti urutan tabel.
- **Simpan:** setiap perubahan disimpan dengan debounce 800 ms dalam batch `save_stock_opname_count`. Indikator di header: "Menyimpan…", "Tersimpan pukul 10.42", atau "Gagal menyimpan" dengan tombol Coba lagi. Nilai yang belum tersimpan tetap ada di layar. Navigasi keluar saat ada perubahan belum tersimpan memunculkan `useUnsavedChanges`.
- **Finalisasi:** tombol di kanan atas. Dialog: ringkasan selisih (jumlah bahan dengan selisih, total nilai selisih), lalu input "Ketik FINALISASI untuk melanjutkan" (`requireTypedText`). Setelah sukses, halaman baca saja dengan banner "Opname sudah difinalisasi pada [tanggal]".
- Error `OPNAME_FINALIZED` saat menyimpan: banner dan halaman menjadi baca saja.

### 15.11 Voucher (`/vouchers`)

- **Daftar:** tabel kode (`font-mono`), nama, tipe, nilai (persen atau nominal), periode, pemakaian (`used / quota` atau `used / ∞`), status (Aktif, Nonaktif, Kedaluwarsa, Belum berlaku), aksi.
- **Filter:** status, pencarian kode atau nama.
- **Form (dialog):**
  - Kode: input uppercase. Tombol "Buat acak" menghasilkan 8 karakter. Validasi format `^[A-Z0-9-]{3,32}$`. Cek keunikan dengan debounce 300 ms melalui RPC atau query terbatas (hanya cek ada atau tidak, tanpa membaca data lain).
  - Nama, tipe (segmented: Persen, Nominal), nilai (persen 1–100 atau nominal > 0).
  - Batas maksimal potongan (hanya tipe persen, opsional, > 0).
  - Minimum belanja (≥ 0).
  - Periode: DateRangeField dengan jam. Validasi: berakhir setelah mulai.
  - Kuota total (opsional, > 0).
  - Pratinjau: input "Contoh belanja" default Rp 100.000 dan hasil potongan dan total akhir dihitung dengan `calculateVoucherDiscount` (fungsi murni yang sama dengan backend).
- **Aksi:** Ubah (dialog yang sama), Nonaktifkan atau Aktifkan (`ConfirmAction`). Voucher sudah dipakai tidak bisa dihapus, tidak ada tombol hapus, hanya nonaktifkan.
- **Laporan pemakaian:** tab di halaman yang sama, menampilkan `get_sales_report.byVoucher` untuk rentang yang dipilih.

### 15.12 Rekening pembayaran (`/payment-accounts`)

- **Daftar:** kartu per metode (Transfer, E-wallet) dengan penyedia, pemilik, nomor (masked), status, urutan.
- **Form:** metode, penyedia, nama pemilik, nomor (`AccountNumberField`, hanya digit, 5 sampai 30 digit), urutan, aktif.
- **Aksi:** Ubah, Nonaktifkan atau Aktifkan. Tidak ada hapus.
- **Urutan:** seret atau tombol panah. Simpan `sort_order` lewat `upsert_payment_account`.
- **Nomor lengkap:** tombol "Lihat nomor lengkap" hanya untuk super admin dan admin. Tidak ada tombol salin di daftar.

### 15.13 Verifikasi pembayaran (`/payment-verification`)

- **Tujuan:** memverifikasi pembayaran transfer dan e-wallet dengan cepat.
- **Antrian:** daftar kiri, `pending_verification`, paling lama di atas. Setiap item: nomor pesanan, nominal, metode, waktu, usia antrian ("sudah 12 menit").
- **Panel kanan:**
  - Bukti: gambar dimuat dengan signed URL (berlaku 600 detik) yang diminta saat item dipilih. Tombol Perbesar (zoom 100 sampai 300%), Putar 90°, Buka di tab baru. Gambar memakai `alt="Bukti pembayaran nomor [referensi]"`.
  - Jika bukti tidak ada: "Bukti belum dilampirkan." dengan tombol "Verifikasi dengan catatan".
  - Detail: nomor pesanan (tautan ke detail), nominal, rekening tujuan, referensi, waktu, kasir pembuat.
- **Aksi:** Setujui (primer, tombol A), Tolak (danger, tombol R, memakai `ConfirmAction` dengan alasan wajib).
- **Setelah aksi:** item dihapus dari antrian, fokus pindah ke item berikutnya, toast "Pembayaran [nomor] disetujui" atau "ditolak".
- **Antrian kosong:** "Tidak ada pembayaran yang menunggu verifikasi." dengan ikon centang.
- **Realtime:** pembayaran baru masuk ke antrian. Pengumuman "N pembayaran baru menunggu verifikasi" tanpa memindahkan fokus.
- **Pintasan:** `A` setujui, `R` tolak, `↑` dan `↓` pindah antrian, `Esc` batal dialog.
- **Parameter `?payment=<id>`:** membuka item tersebut langsung dari halaman detail pesanan.

### 15.14 Laporan (`/reports`)

- **Filter:** DateRangeField dengan preset dan tombol Terapkan. Rentang maksimal 366 hari (sesuai baseline).
- **Ringkasan:** kartu Total penjualan, Transaksi, Rata-rata, Refund, Diskon, Layanan dan pajak, Void. Setiap kartu memakai `Stat`.
- **Tab:**
  - Per hari: grafik batang total penjualan per tanggal, tabel di bawah.
  - Per jam: grafik batang per jam 00 sampai 23.
  - Metode: grafik lingkaran tidak dipakai. Gunakan tabel dengan batang horizontal sederhana.
  - Kategori: tabel dan batang.
  - Item: tabel dengan kolom nama, kategori, qty, penjualan. Baris "Diskon voucher" di bawah dengan nilai negatif (D8).
  - Voucher: tabel dengan kode, nama, pemakaian, total potongan.
- **Ekspor:** setiap tab punya tombol "Unduh CSV" yang mengekspor data tabel tab tersebut.
- **Catatan:** angka laporan dihitung dengan D1 sampai D3. Teks kecil di bawah ringkasan: "Dihitung dari pembayaran terverifikasi pada rentang tanggal Asia/Jakarta."

### 15.15 Pengaturan toko (`/settings`)

- Super admin saja.
- Bagian: Identitas (nama, alamat, telepon, logo), Pajak dan layanan (PB1, layanan, pembulatan), Pembayaran (`require_verified_payment` dengan penjelasan dampak), Struk (header, footer, ukuran kertas 58 atau 80).
- Setiap bagian memiliki form terpisah dengan tombol Simpan sendiri, sehingga perubahan tidak tercampur.
- Persentase pajak dan layanan: 0 sampai 100 dengan dua desimal.
- Saat `require_verified_payment` dimatikan, dialog peringatan: "Pesanan bisa selesai sebelum pembayaran lunas. Selisih akan tercatat di laporan." (`ConfirmAction`).
- Simpan memanggil `update_store_settings`, lalu invalidate `['settings']`.

### 15.16 Branding (`/settings/branding`)

- Super admin saja.
- **Logo:** `ImageField` (PNG, SVG, WEBP, maks 1 MB). Pratinjau di tiga tempat: header, kartu login, dan kertas struk (ukuran monokrom). Unggah ke `public-assets/logo/` lalu simpan `logo_url`.
- **Warna:** `ColorField` untuk primer dan aksen. Setiap warna menampilkan rasio kontras dan status lulus atau gagal (10.2). Tombol Simpan nonaktif jika ada yang gagal.
- **Font:** pilihan dengan pratinjau teks dalam font masing-masing. Pilihan memuat font lewat `dynamic import` `@fontsource`.
- **Pratinjau langsung:** perubahan warna dan font diterapkan ke pratinjau panel di halaman, bukan ke seluruh aplikasi, sampai disimpan. Tombol Batal mengembalikan nilai tersimpan.
- **Setelah simpan:** `applyBranding` memperbarui seluruh aplikasi tanpa muat ulang.

### 15.17 Staff (`/settings/staff`)

- Super admin saja.
- **Tabel:** nama, email, peran (badge), status (Aktif, Nonaktif), dibuat, aksi.
- **Tambah staff (dialog):** email, nama lengkap, peran awal (Admin atau Super admin), password sementara (minimal 10 karakter, dengan tombol generate, dan teks "Berikan password ini secara langsung. Staff bisa menggantinya setelah masuk." Dilarang mengirim password lewat email di UI ini).
- Submit memanggil `POST /api/admin/create-staff` dengan header `Authorization: Bearer <access_token>`. Pemetaan respons:
  - 201: tutup dialog, toast "Staff [nama] dibuat", invalidate `['staff']`.
  - 400 `INPUT_INVALID`: pesan di field email atau password.
  - 400 `STAFF_EMAIL_EXISTS`: pesan di field email.
  - 401 atau 403: pesan "Anda tidak punya hak untuk tindakan ini." Jika 401, sign out.
  - 405, 500: pesan umum dan tombol coba lagi.
- **Ubah peran:** dialog dengan pilihan peran. Konfirmasi `ConfirmAction`. Pemetaan error: `SELF_ROLE_CHANGE_FORBIDDEN`, `LAST_SUPER_ADMIN`. Baris sendiri tidak menampilkan tombol ubah peran.
- **Nonaktifkan:** `ConfirmAction`. Baris sendiri tidak punya tombol. Error `SELF_DEACTIVATION_FORBIDDEN`, `LAST_SUPER_ADMIN`.
- Aktifkan kembali: `set_staff_active` dengan `true`.

### 15.18 Printer (`/settings/printer`)

Detail sesuai bagian 16.

- **Status:** Terhubung ke [nama], Tidak terhubung, atau Tidak didukung di browser ini.
- **Aksi:** Hubungkan printer (memanggil `requestDevice`), Putuskan, Cetak uji.
- **Ukuran kertas:** tampilkan nilai efektif (dari toko atau override). Opsi "Ikuti pengaturan toko" atau 58 mm atau 80 mm. Disimpan di `deviceStore.paperWidthOverride`.
- **Antrian cetak:** daftar pekerjaan gagal (nomor pesanan, waktu, jenis: struk atau ringkasan shift). Aksi: Coba cetak, Hapus. Maksimal 20 pekerjaan.
- **Browser tidak mendukung Web Bluetooth:** tampilkan penjelasan dan tombol "Cetak dengan dialog browser" untuk uji cetak.

### 15.19 Audit (`/audit`)

- Super admin saja.
- **Tabel:** waktu, pengguna (nama), tindakan (teks dari `strings`, bukan kode mentah), entitas, ID entitas (`font-mono`, dapat disalin).
- **Filter:** tindakan (multi pilih), pengguna, entitas, rentang tanggal.
- **Detail (drawer):** payload ditampilkan sebagai daftar pasangan label dan nilai. Nilai uang dengan `Money`. Nilai JSON yang tidak dikenal ditampilkan sebagai teks dalam blok `<pre>` dengan `overflow-x: auto`, bukan dirender sebagai HTML.
- **Hanya baca.** Tidak ada tombol ubah atau hapus.

### 15.20 Halaman 403, 404, dan error route

- **403:** judul "Anda tidak punya akses", deskripsi singkat, tombol "Kembali ke halaman utama" yang menuju `/` (sesuai peran).
- **404:** judul "Halaman tidak ditemukan", tombol ke `/pos` untuk staff.
- **Error route (`RouteErrorBoundary`):** judul "Terjadi kesalahan di halaman ini", tombol Muat ulang dan Kembali. Error dilaporkan ke Sentry, stack trace tidak ditampilkan ke pengguna.

---

## 16. Printing di Browser

### 16.1 Web Bluetooth

- Hanya didukung di Chromium (Android, Windows, macOS, ChromeOS). Deteksi dengan `navigator.bluetooth`.
- Koneksi dimulai dari gestur pengguna. `requestDevice` dengan filter service ESC/POS umum atau `acceptAllDevices` sebagai cadangan.
- Setelah terhubung, simpan id dan nama perangkat di `deviceStore.printer`. Saat halaman dimuat, koneksi ulang otomatis tidak dilakukan (Web Bluetooth membutuhkan gestur); status menjadi "Tidak terhubung" dengan tombol Hubungkan.
- Kirim data per potongan 100 byte dengan jeda 20 ms. Ini dijalankan di Web Worker agar UI tidak macet (opsional jika performa memadai, tetapi wajib tidak memblokir thread utama lebih dari 50 ms per potongan).

### 16.2 Fallback `window.print()`

- Dipakai jika Web Bluetooth tidak tersedia, atau pengguna memilih "Cetak dengan dialog browser".
- Membuat DOM struk tersembunyi (`ReceiptPrintView`), lalu memanggil `window.print()`. Stylesheet `@media print` menyembunyikan seluruh aplikasi dan menampilkan struk dengan lebar 58 mm atau 80 mm.
- Di iOS, dialog cetak berisi AirPrint jika printer tersedia.

### 16.3 Tampilan struk

Isi sama dengan baseline bagian 14: logo (monokrom), nama toko, alamat, telepon, header, garis, nomor pesanan, tanggal dan jam, meja atau pelanggan, item dengan modifier dan jumlah, subtotal, diskon voucher dengan kode, layanan, pajak, pembulatan, total, rincian pembayaran, kembalian, footer, dan QR nomor pesanan.

Cetak ulang diberi baris "REPRINT" di bagian atas.

### 16.4 Antrian

- Pekerjaan cetak gagal disimpan di `localStorage` dengan key `jokger.print-queue.v1`, berisi nomor pesanan, jenis, dan waktu. Dilarang menyimpan isi struk lengkap di localStorage.
- Saat diproses ulang, data struk diambil ulang dari server lewat query `['order', id]`.
- Maksimal 20 pekerjaan. Jika penuh, pekerjaan terlama dibuang dengan toast peringatan.

### 16.5 Perilaku UI printer

- Pencetakan tidak pernah memblokir penyimpanan transaksi.
- Status printer di header dan di layar printer diperbarui saat `connectionStore.printer` berubah.
- Error cetak: toast warning "Struk belum tercetak. Ditambahkan ke antrian." dengan tombol Lihat antrian.

---

## 17. Theme dan Branding saat Runtime

- `applyBranding(settings)` dipanggil oleh `BrandingProvider` setiap kali `['settings']` berubah:
  - Menetapkan `--brand`, `--accent`, `--brand-contrast`, `--brand-hover` pada `document.documentElement.style`.
  - Mengatur `--font-family` ke font yang dipilih dan memuat paket font lewat `dynamic import` jika belum dimuat.
  - Mengatur `document.title` ke `store_name` + " · JOKGER".
  - Mengatur `<link rel="icon">` ke logo jika ada, jika tidak tetap ke favicon bawaan.
- Tidak ada `style` inline pada komponen selain variabel CSS yang dihitung dari token.
- Mode gelap tidak mengubah warna brand. Turunan dihitung ulang untuk setiap mode.

---

## 18. Realtime di UI

| Layar | Subscription | Filter | Efek |
|---|---|---|---|
| Pesanan | `orders` | `status` in (`new`, `processing`, `ready`) | Invalidate `['orders']`, `['order', id]` jika terbuka |
| Verifikasi | `payments` | `status = pending_verification` | Invalidate `['payments', 'pending']` |
| POS | - | - | Tidak ada realtime. Saat checkout, data selalu dari RPC |
| Shift | `payments` | `method = cash` dan `shift_id = aktif` | Invalidate `['shift', 'active']` |

Aturan:
- Realtime hanya mempercepat tampilan. Keputusan tetap berdasarkan respons RPC.
- Event dari sesi lain tidak mengubah keranjang atau form yang sedang diisi.
- Jika event datang saat dialog terbuka, dialog tetap terbuka dan data latar diperbarui.

---

## 19. Keyboard, Fokus, dan Pintasan Global

- Urutan fokus mengikuti urutan visual.
- Indikator fokus: outline 2 px warna `--focus` dengan offset 2 px. Dilarang `outline: none` tanpa pengganti.
- Modal, dialog, drawer, dan sheet: fokus masuk ke elemen pertama yang relevan, dijebak di dalam, dan kembali ke pemicu saat ditutup. Radix Dialog menangani ini.
- `Esc` menutup overlay paling atas.
- Shortcut global: `Ctrl/Cmd + K` membuka pencarian global (menu, pesanan, pelanggan) dengan `Command`. Ini hanya di layar AppShell, tidak di POS (di POS, `/` sudah untuk menu).
- Pencarian global mencari menu aktif, nomor pesanan (3 karakter atau lebih), dan halaman. Hasil dikelompokkan dengan heading.

---

## 20. Aksesibilitas

### 20.1 Standar

WCAG 2.1 AA. Diuji dengan axe-core di setiap route utama dan dengan pemeriksaan manual pada alur POS memakai pembaca layar (NVDA atau TalkBack, sekali per rilis).

### 20.2 Aturan

- Satu `h1` per halaman. Heading tidak melompat level.
- Setiap field berlabel dengan `<label>` atau `aria-labelledby`. Placeholder tidak dipakai sebagai label.
- Setiap tombol ikon memiliki `aria-label`.
- Setiap tabel data memiliki `<caption>` (bisa visually hidden) dan `th scope`.
- Error form diumumkan melalui `aria-live="assertive"` saat submit gagal.
- Status yang berubah (shift, koneksi, printer, pesanan baru) diumumkan melalui live region. Pengumuman digabung agar tidak membanjiri.
- Target sentuh minimal 44×44 px. Jarak minimal 8 px antar target interaktif.
- Kontras teks dan ikon mengikuti 10.2.
- Warna bukan satu-satunya pembeda: status, selisih, dan kesalahan selalu punya teks dan ikon.
- Layout tetap berfungsi pada zoom 200% dan pada teks 200% dari pengaturan OS. Tidak ada teks yang terpotong tanpa cara untuk melihatnya.
- Gerakan dan animasi dihormati dengan `prefers-reduced-motion`.
- Tidak ada konten yang berkedip lebih dari tiga kali per detik.
- Kartu yang dapat diklik adalah tombol atau tautan yang benar, bukan `div` dengan `onClick`.
- Drag and drop selalu punya alternatif keyboard (tombol panah).

### 20.3 Komponen khusus

- `DataTable` pada mode kartu tetap memakai struktur semantik (`dl` atau `ul` dengan `li`).
- Grafik `Chart` punya tabel data yang bisa dibaca pembaca layar. Warna grafik tidak dipakai sebagai satu-satunya pembeda, dan setiap seri punya pola atau label.
- Drawer pembayaran di POS diberi `role="dialog"` dengan `aria-modal="true"` dan `aria-labelledby`.

---

## 21. Responsivitas

| Breakpoint | Lebar | Perilaku utama |
|---|---|---|
| Mobile | <768 px | Bottom navigation, tabel jadi kartu, keranjang bottom sheet, drawer full screen, papan pesanan jadi tab |
| Tablet | 768–1023 px | Bottom navigation dengan label, POS dua kolom (keranjang 320 px), sidebar disembunyikan |
| Desktop | 1024–1439 px | Sidebar, POS tiga area (menu, keranjang, bar pintasan) |
| Layar besar | ≥1440 px | Grid menu 4 kolom, panel detail pesanan tetap terbuka |

Aturan tambahan:
- Mobile-first. Utility Tailwind `md:` dan `lg:` untuk perluasan.
- POS dioptimalkan untuk tablet landscape. Potret menampilkan banner saran rotasi (bisa ditutup, muncul lagi setelah 24 jam).
- Tabel dengan lebih dari 6 kolom tidak boleh dipaksa ke layar kecil. Gunakan mode kartu.
- Gambar selalu `max-width: 100%`.
- Tidak ada scroll horizontal di halaman. Hanya elemen tabel yang boleh scroll horizontal dalam container sendiri.

---

## 22. Performa

### 22.1 Anggaran

| Metrik | Target |
|---|---|
| LCP POS (build production, mobile emulasi, sudah login) | di bawah 2,5 detik |
| INP tambah item dan tombol bayar | di bawah 200 ms |
| CLS | di bawah 0,05 |
| JavaScript awal (gzip) | di bawah 180 KB |
| Chunk per route (gzip) | di bawah 80 KB |
| Skor Lighthouse performa POS dan Pesanan | minimal 85 |

### 22.2 Teknik wajib

- Route-level `lazy` dan `Suspense` dengan skeleton yang sesuai layout.
- `React.memo` untuk baris tabel dan kartu menu. Callback dibungkus `useCallback` hanya jika diteruskan ke komponen memo.
- `useMemo` untuk `calculateTotals` dan daftar yang difilter besar.
- Virtualisasi untuk tabel lebih dari 200 baris (`@tanstack/react-virtual`). Tambahkan ke daftar paket dengan versi terkunci jika dipakai.
- Gambar menu: `loading="lazy"`, `decoding="async"`, `width` dan `height` eksplisit, format WEBP.
- Ikon diimpor per nama.
- Font: hanya subset Latin dan Latin Extended, weight yang dipakai saja.
- Tidak ada library grafik besar. `Chart` memakai SVG.
- Debounce 250 ms untuk pencarian, 300 ms untuk validasi keunikan, 800 ms untuk autosave opname.
- Prefetch route POS saat halaman login terbuka (setelah idle).

### 22.3 Larangan performa

- Dilarang memuat seluruh riwayat sekaligus.
- Dilarang polling di layar selain Pesanan dan Verifikasi (dan Pesanan/Verifikasi hanya 30 detik jika realtime terputus).
- Dilarang `useEffect` yang memanggil `setState` dengan nilai turunan. Gunakan nilai turunan langsung.

---

## 23. Keamanan di Frontend

- Tidak ada secret di kode klien. Hanya `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, dan `VITE_APP_ENV`.
- Tidak ada `dangerouslySetInnerHTML`. Lint rule `react/no-danger` aktif sebagai error.
- Data pengguna dirender sebagai teks. Tautan eksternal (misalnya bukti) hanya `https:` dan `blob:` dari Storage.
- Signed URL bukti tidak disimpan di store atau cache lebih dari 10 menit. Query key `['proof', path]` dengan `staleTime` 9 menit dan `gcTime` 0.
- Token sesi tidak pernah ditampilkan, dicatat, atau dimasukkan ke error report.
- `window.open` untuk bukti memakai `noopener,noreferrer`.
- Upload file: validasi tipe dengan `file.type` dan magic bytes (dua byte pertama) di klien. Validasi final di Storage.
- Penyalinan nomor rekening memakai `navigator.clipboard.writeText`. Tidak ada log nomor rekening.
- Saat keluar, `queryClient.clear()` dan tidak ada data pribadi yang tersisa di memori.
- Tidak ada data sensitif di URL kecuali ID entitas. Filter di query string hanya berisi nilai non-pribadi.
- Logger menghapus email, nomor telepon, nomor rekening, token, dan nilai input password dari setiap payload sebelum dikirim ke Sentry (`beforeSend`).
- CSP sesuai `vercel.json` baseline. Tidak ada inline script. Gaya inline hanya lewat variabel CSS dan `style` yang dihitung dari token (diizinkan oleh `style-src 'unsafe-inline'`).

---

## 24. Logging dan Error Reporting

- `shared/lib/logger.ts`: fungsi `logError`, `logWarn`, `logInfo`. Hanya `logError` yang mengirim ke Sentry. `logInfo` hanya di mode `local`.
- Setiap `AppError` yang tidak ditangani diberi tag `error_code` dan `route`.
- Error boundary melaporkan error dengan komponen stack, tanpa data form.
- Sentry: `tracesSampleRate` 0,1, `replaysOnErrorSampleRate` 0 (tidak merekam sesi layar untuk melindungi data).
- Breadcrumb: navigasi route dan panggilan RPC (nama fungsi, bukan parameter).

---

## 25. Pengujian Frontend

### 25.1 Lapisan

| Lapisan | Alat | Cakupan wajib | Ambang |
|---|---|---|---|
| Unit logika | Vitest | `format.ts`, `money.ts`, `datetime.ts`, `contrast.ts`, `errors.ts`, `csv.ts`, `receipt.ts`, `logic.ts` setiap fitur | Baris 90%, cabang 80% |
| Store | Vitest | `cartStore`, `deviceStore`, `themeStore`, `connectionStore` | 100% cabang |
| Hook | Vitest + Testing Library | `useRealtime`, `useIdleTimeout`, `useUnsavedChanges`, `useShortcut`, `useDebouncedValue` | Lulus |
| Komponen primitif | Vitest + Testing Library | Semua `shared/ui` dan `shared/components`: varian, state, disabled, loading | Lulus |
| Form | Vitest + Testing Library | Setiap form: validasi, submit, error server, dirty state | Lulus |
| Layar | Vitest + Testing Library (dengan mock `api`) | Setiap layar: empat state, aksi utama | Lulus |
| E2E | Playwright | Lihat 25.3 | Lulus di empat browser dan dua viewport mobile |
| Aksesibilitas | @axe-core/playwright | Semua route utama, tema terang dan gelap | Nol serius atau kritis |
| Performa | Lighthouse CI | `/login`, `/pos`, `/orders` (sesuai D14) | Skor minimal 85 |

### 25.2 Test komponen wajib

**`Money`**
- Format `12500` menjadi `Rp 12.500`.
- `0` menjadi `Rp 0`.
- Negatif dengan `signed` menjadi `−Rp 5.000` dengan tone danger.
- Tidak menerima nilai pecahan (melempar error dev atau dibulatkan ke bawah, dan test memverifikasi perilakunya sesuai pilihan).

**`QuantityField`**
- Tidak bisa di bawah 1 atau di atas 100.
- Tombol `−` nonaktif di 1, `+` nonaktif di 100.

**`ConfirmAction`**
- Tombol konfirmasi nonaktif saat alasan kosong atau kurang dari 3 karakter.
- Teks ketik ulang harus persis sama (case-sensitive).
- Fokus awal bukan pada tombol destruktif.

**`StatusBadge`**
- Setiap status menampilkan ikon dan teks yang sama dengan tabel 10.3.

**`DataTable`**
- Sort toggle mengubah `aria-sort`.
- Mode kartu di bawah 768 px.
- Baris kosong menampilkan `EmptyState`.

**`NumericKeypad`** dan **`QuickCash`**
- Tombol keypad memanggil `onKey` dengan digit yang benar.
- `QuickCash` menampilkan uang pas dan pembulatan berikutnya.

**`SearchInput`**
- Debounce 250 ms: hanya satu panggilan `onChange` setelah jeda.

### 25.3 E2E wajib (Playwright)

Setiap skenario di bawah ini memakai database seed terpisah dan direset sebelum suite. Nomor skenario mengikuti baseline 17.3.

1. Login admin dan super admin. Lima kegagalan login memunculkan lockout 30 detik dengan hitung mundur.
2. Admin membuka `/settings/staff` dan melihat halaman 403. URL tidak berubah.
3. Buka shift, pilih item lewat klik, bayar tunai dengan `QuickCash`, selesai, struk masuk antrian saat printer tidak tersedia (mock).
4. Pesanan transfer: pilih rekening, isi referensi, unggah bukti, kirim. Admin memverifikasi di `/payment-verification` dengan tombol A. Pesanan dapat diselesaikan.
5. Open bill: buka, tambah item dua kali, tutup dengan split tunai dan transfer. Struk hanya bisa dicetak setelah tutup.
6. Void item dengan alasan. Stok bahan bertambah di inventaris (dibaca dari UI).
7. Batalkan pesanan yang sudah dibayar tunai. Refund tampil sebagai nominal negatif di detail.
8. Tutup shift dengan kas kurang. Selisih tampil "Kurang Rp X" dengan teks dan warna.
9. Opname: buka, isi hitungan, simpan otomatis tampil "Tersimpan", finalisasi dengan mengetik `FINALISASI`.
10. Buat voucher persen dengan batas maksimal, terapkan di POS, total dan diskon sesuai pratinjau dan hasil server.
11. POS hanya dengan keyboard: `/`, angka, `Enter` untuk tambah modifier, `F2`, pilih metode, selesai.
12. Tema gelap dan terang pada POS. Kontras teks dan status tetap terbaca (axe).
13. Viewport 768 px: keranjang bottom sheet dibuka dan ditutup, tombol bayar tetap terlihat.
14. Koneksi putus saat pembayaran (`context.setOffline(true)`): tombol bayar nonaktif, banner tampil. Saat koneksi kembali, klik bayar memakai `clientRef` yang sama dan tidak membuat pesanan ganda.
15. Harga berubah saat checkout (ubah harga di database di antara pratinjau dan submit): muncul pesan "Harga menu berubah", keranjang tetap ada.
16. Realtime: pesanan baru dari sesi kedua muncul di `/orders` tanpa muat ulang.
17. Super admin mengubah warna brand dengan kontras rendah: tombol simpan nonaktif dan pesan `CONTRAST_TOO_LOW`.
18. Riwayat: ekspor CSV, jumlah baris sama dengan jumlah baris tabel.
19. Laporan: total penjualan di kartu sama dengan total pembayaran verified di tab Per hari.
20. Idle timeout (dengan waktu dipercepat di test): sesi berakhir, pesan muncul, redirect ke login.
21. Printer: halaman printer di browser tanpa Web Bluetooth menampilkan penjelasan dan tombol cetak browser.

### 25.4 Data uji

- Seed berisi kategori, menu dengan modifier, bahan, resep, rekening, dan pengaturan default.
- Akun uji dibuat lewat skrip seed dengan Supabase Auth admin API, hanya di `local` dan `staging`.
- Fixture di `tests/fixtures` berisi hanya data sintetis.

---

## 26. Copy dan Bahasa UI

- Semua teks dalam Bahasa Indonesia baku tetapi ramah. Tidak memakai istilah teknis di layar kasir (misalnya dilarang menampilkan "RPC", "constraint", "RLS", "status enum").
- Kalimat kesalahan menjelaskan apa yang terjadi dan apa yang bisa dilakukan. Contoh: "Stok Kopi Susu tidak cukup. Kurangi jumlah atau ubah resep." Bukan "STOCK_INSUFFICIENT".
- Tombol memakai kata kerja: "Simpan", "Bayar", "Tutup kasir", "Batalkan pesanan".
- Judul dialog konfirmasi berbentuk pertanyaan. Contoh: "Batalkan pesanan JKG-20261008-0001?"
- Tidak ada tanda seru berlebihan.
- Angka uang selalu memakai format `Money`.
- Struktur kunci di `strings/id.ts` mengikuti area: `common`, `auth`, `pos`, `openBill`, `orders`, `history`, `shift`, `menu`, `inventory`, `opname`, `vouchers`, `paymentAccounts`, `paymentVerification`, `reports`, `settings`, `branding`, `staff`, `printer`, `audit`, `errors`, `shortcuts`.
- Setiap kode error dari baseline bagian 11 wajib ada di `strings.errors` dengan kunci sama dengan kode.

---

## 27. Kriteria Penerimaan Frontend

Semua poin harus terpenuhi dan dibuktikan dengan output perintah atau hasil E2E.

1. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, dan `pnpm test:e2e` hijau.
2. Tidak ada `dangerouslySetInnerHTML`, `console.*`, `any` tanpa justifikasi, atau `@ts-ignore` baru (diverifikasi lint dan pencarian kode).
3. Tidak ada penulisan tabel dari klien (`.from(...).insert|update|upsert|delete` tidak ditemukan).
4. Tidak ada string Indonesia literal di JSX di luar `strings/id.ts` (diverifikasi dengan pencarian dan lint custom rule).
5. Setiap layar di bagian 15 menampilkan empat state: memuat, kosong, error, berhasil.
6. Setiap aksi destruktif memakai `ConfirmAction` dengan alasan atau teks sesuai tabel 12.5.
7. Keranjang bertahan saat halaman dimuat ulang dan dihapus hanya setelah pesanan berhasil atau dikosongkan pengguna.
8. Checkout yang gagal tidak menghapus keranjang.
9. Retry setelah timeout memakai `clientRef` yang sama (diuji E2E 14).
10. Harga berubah saat checkout menampilkan pesan dan mempertahankan keranjang (diuji E2E 15).
11. Admin tidak melihat menu atau halaman super admin, dan URL langsung menampilkan 403.
12. Realtime memperbarui `/orders` dan `/payment-verification` tanpa muat ulang (diuji E2E 16).
13. Branding (warna, logo, font) berlaku di seluruh aplikasi setelah simpan tanpa muat ulang halaman.
14. Warna dengan kontras di bawah standar tidak bisa disimpan.
15. POS bisa dipakai penuh dengan keyboard dan pada viewport 768 px.
16. Semua target sentuh interaktif memiliki minimal 44×44 px (diuji dengan pemeriksaan otomatis pada komponen utama).
17. Semua halaman lolos axe dengan nol pelanggaran serius atau kritis, pada tema terang dan gelap.
18. Lighthouse performa POS dan Pesanan minimal 85 dengan login (D14).
19. Bundle awal di bawah 180 KB gzip, chunk route di bawah 80 KB gzip.
20. Tidak ada token, data transaksi, atau nomor rekening di `localStorage` kecuali kunci yang tercantum di bagian 8 dan 16.4 (antrian cetak tanpa isi struk).
21. Sign out menghapus cache query dan mempertahankan keranjang hanya setelah konfirmasi pengguna.
22. Idle timeout 8 jam berfungsi (diuji dengan waktu dipercepat).
23. Semua pintasan di bagian 15.2 bekerja dan bisa dimatikan di pengaturan perangkat.
24. Halaman printer memberi penjelasan jelas saat Web Bluetooth tidak tersedia, dan fallback cetak browser berfungsi.
25. Semua pesan error dari server ditampilkan dalam Bahasa Indonesia melalui pemetaan `AppError`.

---

## 28. Larangan untuk AI Coding (Frontend)

- Menulis string Indonesia di JSX di luar `strings/id.ts`.
- Menulis tabel langsung dari klien.
- Memakai `dangerouslySetInnerHTML`.
- Menyimpan token, data transaksi, atau nomor rekening di `localStorage`, `sessionStorage`, atau cookie non-httpOnly.
- Memakai CDN untuk font, script, atau stylesheet.
- Menambah UI library di luar daftar bagian 4.
- Memformat rupiah secara manual atau memakai `toLocaleString` tanpa `Money`.
- Membuat update optimistik untuk transaksi uang, stok, atau status pesanan.
- Menampilkan `0` saat data sebenarnya sedang memuat.
- Menghapus keranjang saat checkout gagal.
- Membuat versi lokal dari komponen yang sudah ada di `shared/`.
- Menurunkan ambang coverage, skor Lighthouse, atau kriteria axe.
- Menganggap pemeriksaan peran di UI sebagai pengganti RLS.
- Menggunakan `outline: none` tanpa pengganti fokus.
- Membuat layar tanpa empat state.
- Mengubah urutan atau label tombol di POS tanpa memperbarui E2E dan dokumen ini.
