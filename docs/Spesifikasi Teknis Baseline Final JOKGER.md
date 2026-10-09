# Spesifikasi Teknis Baseline Final JOKGER (React)

Dokumen ini adalah sumber kebenaran tunggal untuk AI coding yang membangun JOKGER dari nol sampai siap deployment. Jika ada yang tidak tertulis di sini, AI harus berhenti dan bertanya, bukan menebak. Spesifikasi ini menggantikan dua spesifikasi sebelumnya dan sudah memuat keputusan atas temuan audit.

---

## 0. Aturan Baku untuk AI Coding

1. Kerjakan persis sesuai spesifikasi. Dilarang menambah fitur, tabel, RPC, atau library yang tidak tercantum di sini tanpa persetujuan tertulis.
2. Dilarang membuat mock data, placeholder, TODO, atau fitur setengah jadi di kode produksi.
3. Dilarang menggunakan `any`, `@ts-ignore`, `@ts-expect-error`, atau `eslint-disable` tanpa komentar justifikasi satu baris. Justifikasi tanpa alasan teknis yang jelas tidak diterima.
4. Dilarang menulis nilai uang sebagai `float`. Semua uang adalah integer rupiah.
5. Dilarang menulis langsung ke tabel dari klien. Semua penulisan data operasional lewat RPC. Pengecualian: upload ke Supabase Storage dan pemanggilan endpoint `/api/admin/create-staff`.
6. Dilarang menaruh `SUPABASE_SERVICE_ROLE_KEY` di kode klien, di file dengan prefix `VITE_`, atau di bundle.
7. Dilarang menghapus atau melemahkan test untuk membuat build hijau.
8. Setiap RPC baru wajib disertai test pgTAP. Setiap halaman wajib lolos axe.
9. Setiap perubahan skema dilakukan dengan migrasi baru. Migrasi yang sudah di-commit tidak boleh diubah.
10. Semua teks UI berbahasa Indonesia dan berada di satu file `shared/strings/id.ts`. Tidak ada teks UI yang ditulis langsung di komponen.
11. Komentar kode ditulis dalam Bahasa Indonesia, ringkas, dan hanya pada RPC, tipe publik, dan logika yang tidak jelas dari kodenya.
12. Tidak ada dokumen tambahan (README panjang, CHANGELOG, docs terpisah). Satu `README.md` pendek berisi perintah menjalankan proyek boleh ada.

---

## 1. Keputusan Final

Bagian ini menutup semua ambiguitas. Jika ada konflik dengan bagian lain, bagian ini yang berlaku.

| Kode | Topik | Keputusan |
|---|---|---|
| D1 | Definisi pendapatan | Pendapatan = jumlah `payments.amount` dengan `status = 'verified'`. Refund disimpan sebagai pembayaran bernilai negatif berstatus `verified`. Status pesanan tidak menjadi syarat laporan. |
| D2 | Tanggal pendapatan | Dihitung berdasarkan `payments.created_at` dalam zona `Asia/Jakarta`. |
| D3 | Kas shift | Kas yang diharapkan = saldo awal + jumlah pembayaran tunai `verified` dengan `payments.shift_id` = shift tersebut (refund tunai ikut mengurangi). Ini sama dengan dasar laporan (D1), sehingga laporan dan kas selalu cocok. |
| D4 | Pesanan selesai | Pesanan hanya bisa `completed` jika total pembayaran `verified` ≥ `grand_total`. Pengaturan `require_verified_payment` bisa dimatikan oleh super admin, tetapi default-nya aktif. Jika dimatikan, pesanan boleh selesai tanpa lunas dan selisihnya tercatat. |
| D5 | Pembatalan pesanan yang sudah dibayar | Pembatalan membuat refund otomatis sebesar pembayaran `verified` yang ada. Kasir mengembalikan uang di luar sistem. Refund tercatat sebagai pembayaran negatif. |
| D6 | Retur pesanan selesai | Hanya super admin. Status pesanan menjadi `cancelled`, kolom `cancelled_from = 'completed'`, stok dikembalikan, refund dibuat. Alasan wajib. |
| D7 | Laporan | Satu RPC `get_sales_report` mengembalikan seluruh data laporan dalam satu jsonb. Rentang tanggal memakai tanggal lokal Jakarta (inklusif). |
| D8 | Item dan kategori di laporan | Penjualan item dihitung dari `line_total` item tidak di-void pada pesanan tidak `cancelled`. Angka ini sebelum diskon. Laporan menampilkan baris terpisah "Diskon voucher" agar selisih dengan total pembayaran terlihat. |
| D9 | Akses printer | Pengaturan printer (pairing Bluetooth dan ukuran kertas perangkat) bisa diakses admin dan super admin karena sifatnya lokal perangkat. Lebar kertas default toko tetap diatur super admin. |
| D10 | Logo | Kolom bernama `logo_url` berisi public URL dari Storage. |
| D11 | Pembuatan staff | Lewat endpoint serverless `/api/admin/create-staff`. Perubahan peran dan status lewat RPC. Semua tercatat di `audit_logs`. |
| D12 | Font branding | Pilihan terbatas: `Inter`, `Plus Jakarta Sans`, `Poppins`, dan `system-ui`. Font dimuat lokal dari paket npm (`@fontsource`), tidak dari CDN eksternal. |
| D13 | Realtime | Dipakai di halaman Pesanan dan Verifikasi Pembayaran. Event memicu invalidasi query TanStack Query, bukan update manual. |
| D14 | Lighthouse | Diukur pada build production, dengan login otomatis memakai akun uji, untuk halaman `/login`, `/pos`, dan `/orders`. |
| D15 | Voucher dan void | Jika void item membuat subtotal di bawah `min_subtotal` voucher, voucher dilepas otomatis dalam transaksi yang sama, redemption dihapus, `used_count` dikurangi, dan respons RPC menyebut `voucher_released`. |
| D16 | Stok negatif | Default tidak diizinkan. Super admin bisa mengizinkan per pergerakan dengan parameter eksplisit dan alasan wajib. |

---

## 2. Ruang Lingkup

**Termasuk:** autentikasi dua peran; POS; pesanan dengan status baru, diproses, siap, selesai, dan dibatalkan; open bill dengan pembayaran di akhir; pembayaran tunai, transfer, e-wallet, dan split; verifikasi pembayaran dengan bukti; voucher kustom; shift kasir; menu, modifier, dan resep; inventaris, pembelian, waste, dan stok opname; laporan; riwayat transaksi dan ekspor CSV; rekening pembayaran; pengaturan toko dan branding; manajemen staff; cetak struk Bluetooth dan fallback cetak browser; audit log; ekspor CSV; realtime pada dua layar.

**Tidak termasuk:** payment gateway, multi-outlet, pemesanan online pelanggan, mode offline penuh, integrasi akuntansi, notifikasi WhatsApp, dan loyalty.

---

## 3. Stak Teknologi

| Lapisan | Paket | Versi | Catatan |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | Dikunci di `.nvmrc` |
| Package manager | pnpm | 9 | `packageManager` di root |
| Bahasa | TypeScript | 5.5+ | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| UI | react, react-dom | 18.3 | Pakai 18 agar kompatibel dengan ekosistem |
| Build | vite, @vitejs/plugin-react | 5.x | |
| Routing | react-router-dom | 6.28+ | Route dengan `lazy` |
| Data server | @tanstack/react-query | 5.x | Satu-satunya cache server |
| State lokal | zustand | 5.x | Keranjang, perangkat, tema |
| Form | react-hook-form, @hookform/resolvers | 7.x, 3.x | |
| Validasi | zod | 3.23+ | Dipakai di klien dan endpoint API |
| Backend | @supabase/supabase-js | 2.x terbaru | |
| Styling | tailwindcss | 3.4.x | Tidak memakai v4 |
| Komponen | shadcn/ui di atas Radix UI | - | Komponen disalin ke `shared/ui` |
| Ikon | lucide-react | terbaru | |
| Tanggal | date-fns | 3.x | Zona lewat `Intl`, tanpa paket tz tambahan |
| Font | @fontsource/inter, @fontsource/plus-jakarta-sans, @fontsource/poppins | terbaru | |
| Cetak ESC/POS | @point-of-sale/receipt-printer-encoder | terbaru | Dikunci versinya |
| Error tracking | @sentry/react, @sentry/node | 8.x | Dengan `beforeSend` penyaring data pribadi |
| Serverless | Vercel Functions (Node.js 20) | - | Hanya untuk `/api` |
| Hosting | Vercel | - | Deploy dari Git |
| Database | Supabase (PostgreSQL 15+) | - | Auth, Storage, Realtime |
| Unit & komponen test | vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom | vitest 2.x | |
| Database test | pgTAP lewat `supabase test db` | - | |
| E2E | @playwright/test | 1.47+ | |
| Aksesibilitas | @axe-core/playwright | terbaru | |
| Performa | @lhci/cli | 0.14+ | |
| Lint | eslint 9 (flat config), typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y | terbaru | |
| Format | prettier | 3.x | |
| Git hook | husky, lint-staged, commitlint | terbaru | |

Dilarang menambah paket di luar daftar ini kecuali untuk dependensi transitif.

---

## 4. Arsitektur

```
Browser (React SPA, Vite build)
  ├─ TanStack Query ──► supabase-js (anon key + JWT pengguna)
  │                       ├─ SELECT tabel (dibatasi RLS)
  │                       ├─ rpc() untuk semua penulisan
  │                       ├─ Storage (bukti bayar, logo)
  │                       └─ Realtime (orders, payments)
  ├─ Web Bluetooth ──► printer termal ESC/POS
  └─ fetch('/api/...') ──► Vercel Function ──► Supabase (service role, server saja)
```

Prinsip:
1. Database adalah sumber kebenaran. Aturan uang, stok, status, dan akses ditegakkan di PostgreSQL.
2. Klien hanya menampilkan dan mengirim niat. Perhitungan di klien (ringkasan keranjang) hanya untuk tampilan dan harus sama dengan server.
3. Setiap RPC berjalan dalam satu transaksi. Error apa pun membatalkan seluruh perubahan.
4. Tidak ada state server yang disalin ke Zustand. Data server hanya di TanStack Query.

---

## 5. Struktur Repositori

```
jokger/
├─ apps/web/
│  ├─ index.html
│  ├─ public/favicon.svg
│  ├─ src/
│  │  ├─ main.tsx
│  │  ├─ app/
│  │  │  ├─ App.tsx                 # provider dan router
│  │  │  ├─ router.tsx              # definisi route dan lazy import
│  │  │  ├─ providers.tsx           # QueryClient, Session, Theme, Toaster
│  │  │  ├─ guards/RequireAuth.tsx
│  │  │  ├─ guards/RequireRole.tsx
│  │  │  └─ layouts/{AppShell.tsx, PosLayout.tsx}
│  │  ├─ features/
│  │  │  ├─ auth/
│  │  │  ├─ pos/
│  │  │  ├─ open-bill/
│  │  │  ├─ orders/
│  │  │  ├─ history/
│  │  │  ├─ shift/
│  │  │  ├─ menu/
│  │  │  ├─ inventory/
│  │  │  ├─ opname/
│  │  │  ├─ vouchers/
│  │  │  ├─ payment-accounts/
│  │  │  ├─ payment-verification/
│  │  │  ├─ reports/
│  │  │  ├─ settings/
│  │  │  ├─ branding/
│  │  │  ├─ staff/
│  │  │  ├─ printing/
│  │  │  └─ audit/
│  │  ├─ shared/
│  │  │  ├─ ui/                     # komponen shadcn yang sudah disalin
│  │  │  ├─ components/             # komponen aplikasi lintas fitur (Money, StatusBadge, DataTable, dll)
│  │  │  ├─ lib/                    # money.ts, datetime.ts, errors.ts, csv.ts, logger.ts, supabase.ts, contrast.ts
│  │  │  ├─ stores/                 # cart.ts, device.ts, theme.ts
│  │  │  ├─ hooks/                  # useRealtime.ts, useShortcut.ts, useDebouncedValue.ts
│  │  │  ├─ strings/id.ts
│  │  │  └─ types/database.ts       # hasil generate, tidak diedit manual
│  │  └─ styles/index.css
│  ├─ tests/                        # setup, util render, fixture
│  ├─ e2e/                          # Playwright
│  ├─ vite.config.ts
│  ├─ vitest.config.ts              # satu config untuk unit dan komponen
│  ├─ playwright.config.ts
│  └─ tailwind.config.ts
├─ api/
│  ├─ package.json                  # dependensi fungsi serverless sendiri
│  ├─ tsconfig.json
│  └─ admin/create-staff.ts
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                   # bertanggal, berurutan, tidak diubah setelah commit
│  ├─ seed.sql                      # hanya local dan staging
│  └─ tests/                        # pgTAP
├─ docs/Spesifikasi.md              # file ini
├─ .github/workflows/ci.yml
├─ lighthouserc.cjs
├─ vercel.json
├─ .env.example
├─ .nvmrc
├─ pnpm-workspace.yaml
└─ package.json
```

Aturan struktur fitur:
- Setiap fitur hanya mengimpor dari `shared/` dan dari `index.ts` fitur lain. Dilarang mengimpor file internal fitur lain.
- `api.ts` berisi fungsi pemanggil Supabase dan mengembalikan `Result`, bukan melempar error.
- `hooks.ts` berisi hook TanStack Query dan mutasi.
- `logic.ts` berisi fungsi murni tanpa efek samping, yang wajib diuji unit.

---

## 6. Konfigurasi dan Deployment

### 6.1 Variabel lingkungan

| Variabel | Lokasi | Keterangan |
|---|---|---|
| `VITE_SUPABASE_URL` | Klien | URL proyek |
| `VITE_SUPABASE_ANON_KEY` | Klien | Anon key |
| `VITE_SENTRY_DSN` | Klien | Opsional |
| `VITE_APP_ENV` | Klien | `local`, `staging`, `production` |
| `SUPABASE_URL` | Vercel Function | Sama dengan klien |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Function saja | Tidak boleh masuk bundle |
| `SENTRY_DSN` | Vercel Function | Opsional |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SUPER_EMAIL`, `E2E_SUPER_PASSWORD` | CI | Hanya untuk proyek lokal dan staging |

Setiap lingkungan memiliki proyek Supabase sendiri: `local` (Supabase CLI), `staging`, dan `production`.

### 6.2 vercel.json

Harus berisi:
- `installCommand`: `pnpm install --frozen-lockfile`
- `buildCommand`: `pnpm --filter @jokger/web build`
- `outputDirectory`: `apps/web/dist`
- `functions` untuk `api/**/*.ts` dengan runtime `nodejs20.x`
- rewrite SPA: semua path yang tidak diawali `/api/` ke `/index.html`
- header pada `/(.*)`:
  - `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy: bluetooth=(self), camera=(), microphone=(), geolocation=()`

### 6.3 Konfigurasi Supabase

- `site_url` sama dengan domain Vercel.
- `enable_signup = false`.
- Email confirmation dimatikan karena akun dibuat oleh super admin.
- Password minimal 10 karakter.
- Rate limit login dikonfigurasi di Supabase Auth dan dicatat sebagai langkah manual di README.
- Publication `supabase_realtime` berisi `orders` dan `payments`.

---

## 7. Model Data

### 7.1 Enum

```sql
create type role_type as enum ('super_admin', 'admin');
create type order_type as enum ('dine_in', 'takeaway');
create type order_status as enum ('new', 'processing', 'ready', 'completed', 'cancelled');
create type bill_state as enum ('open', 'closed');
create type payment_method as enum ('cash', 'transfer', 'ewallet');
create type payment_status as enum ('pending_verification', 'verified', 'rejected');
create type voucher_type as enum ('percent', 'nominal');
create type movement_type as enum ('purchase', 'sale', 'void_return', 'cancel_return', 'adjustment', 'opname', 'waste');
create type shift_status as enum ('open', 'closed');
create type opname_status as enum ('draft', 'finalized');
```

### 7.2 Tabel identitas dan pengaturan

```sql
profiles (
  id uuid pk references auth.users on delete cascade,
  email text unique,
  full_name text not null,
  role role_type not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

store_settings (                       -- tepat satu baris, id = 1
  id int pk default 1 check (id = 1),
  store_name text not null,
  address text,
  phone text,
  logo_url text,
  primary_color text not null default '#6F4E37',
  accent_color text not null default '#F5E6D3',
  font_family text not null default 'Inter' check (font_family in ('Inter','Plus Jakarta Sans','Poppins','system-ui')),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  service_percent numeric(5,2) not null default 0 check (service_percent between 0 and 100),
  rounding_rule text not null default 'none' check (rounding_rule in ('none','up_100','nearest_100')),
  receipt_header text,
  receipt_footer text,
  paper_width_mm int not null default 58 check (paper_width_mm in (58, 80)),
  require_verified_payment boolean not null default true,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
)

payment_accounts (
  id uuid pk default gen_random_uuid(),
  method payment_method not null check (method in ('transfer','ewallet')),
  provider text not null,
  account_name text not null,
  account_no text not null check (account_no ~ '^[0-9]+$'),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

audit_logs (
  id bigint identity pk,
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
)
```

### 7.3 Menu

```sql
categories (id uuid pk, name text unique not null, sort_order int not null default 0, is_active boolean not null default true)

menu_items (
  id uuid pk, category_id uuid not null references categories,
  name text not null, description text,
  price bigint not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
)

modifier_groups (id uuid pk, name text not null, min_select int not null default 0, max_select int not null default 1,
  check (min_select >= 0 and max_select >= min_select))
modifier_options (id uuid pk, group_id uuid not null references modifier_groups on delete cascade,
  name text not null, extra_price bigint not null default 0 check (extra_price >= 0), is_active boolean not null default true)
menu_item_modifier_groups (menu_item_id uuid references menu_items on delete cascade, group_id uuid references modifier_groups on delete cascade, primary key (menu_item_id, group_id))
```

### 7.4 Inventaris

```sql
inventory_items (
  id uuid pk, name text not null, unit text not null,
  current_qty numeric(14,3) not null default 0,
  min_qty numeric(14,3) not null default 0,
  unit_cost bigint not null default 0 check (unit_cost >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
)
recipe_lines (menu_item_id uuid references menu_items on delete cascade, inventory_item_id uuid references inventory_items,
  qty_per_serving numeric(14,3) not null check (qty_per_serving > 0), primary key (menu_item_id, inventory_item_id))
stock_movements (
  id bigint identity pk, inventory_item_id uuid not null references inventory_items,
  movement_type movement_type not null,
  qty_change numeric(14,3) not null check (qty_change <> 0),
  reference_type text, reference_id text,
  note text, actor_id uuid references profiles(id),
  created_at timestamptz not null default now()
)
stock_opnames (id uuid pk, status opname_status not null default 'draft', opened_by uuid references profiles(id),
  opened_at timestamptz not null default now(), finalized_at timestamptz)
stock_opname_lines (opname_id uuid references stock_opnames on delete cascade, inventory_item_id uuid references inventory_items,
  system_qty numeric(14,3) not null, counted_qty numeric(14,3), primary key (opname_id, inventory_item_id))
```

`inventory_items.current_qty` adalah cache dari `stock_movements`. Setiap perubahan stok wajib menulis movement dan memperbarui cache dalam satu transaksi.

### 7.5 Shift, voucher, pesanan, pembayaran

```sql
shifts (
  id uuid pk, status shift_status not null default 'open',
  opened_by uuid not null references profiles, opened_at timestamptz not null default now(),
  opening_cash bigint not null check (opening_cash >= 0),
  closed_by uuid references profiles, closed_at timestamptz,
  expected_cash bigint, actual_cash bigint, difference bigint,
  note text
)
create unique index one_open_shift on shifts ((true)) where status = 'open';

daily_sequences (day date pk, last_no int not null default 0)  -- tanpa policy, hanya diakses fungsi definer

vouchers (
  id uuid pk, code text unique not null check (code = upper(code) and code ~ '^[A-Z0-9-]{3,32}$'),
  name text not null,
  type voucher_type not null,
  value bigint not null check (value > 0),
  min_subtotal bigint not null default 0 check (min_subtotal >= 0),
  max_discount bigint check (max_discount is null or max_discount > 0),
  valid_from timestamptz not null, valid_until timestamptz not null,
  total_quota int check (total_quota is null or total_quota > 0),
  used_count int not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  created_by uuid references profiles, created_at timestamptz not null default now(),
  check (valid_until > valid_from),
  check (type <> 'percent' or value between 1 and 100)
)
voucher_redemptions (id uuid pk, voucher_id uuid not null references vouchers, order_id uuid not null references orders, discount bigint not null, created_at timestamptz not null default now())

orders (
  id uuid pk, order_no text unique not null,            -- JKG-YYYYMMDD-0001
  shift_id uuid not null references shifts,
  order_type order_type not null,
  status order_status not null default 'new',
  bill_state bill_state,                                -- null = pesanan biasa
  table_label text, customer_name text,
  subtotal bigint not null default 0 check (subtotal >= 0),
  discount_total bigint not null default 0 check (discount_total >= 0),
  service_amount bigint not null default 0,
  tax_amount bigint not null default 0,
  rounding_amount bigint not null default 0,
  grand_total bigint not null default 0 check (grand_total >= 0),
  voucher_id uuid references vouchers, voucher_code text,
  cancelled_from order_status,
  cancel_reason text,
  created_by uuid not null references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (status <> 'cancelled' or cancel_reason is not null)
)

order_items (
  id uuid pk, order_id uuid not null references orders on delete cascade,
  menu_item_id uuid not null references menu_items,
  item_name text not null, unit_price bigint not null check (unit_price >= 0),
  modifiers jsonb not null default '[]',                -- snapshot [{group, name, extra_price}]
  qty int not null check (qty between 1 and 100),
  line_total bigint not null check (line_total >= 0),
  note text,
  is_voided boolean not null default false,
  void_reason text, voided_by uuid references profiles, voided_at timestamptz,
  created_at timestamptz not null default now()
)

payments (
  id uuid pk, order_id uuid not null references orders,
  shift_id uuid not null references shifts,
  method payment_method not null,
  payment_account_id uuid references payment_accounts,
  amount bigint not null check (amount <> 0),           -- negatif hanya untuk refund
  received_amount bigint check (received_amount is null or received_amount >= 0),
  change_amount bigint not null default 0 check (change_amount >= 0),
  is_refund boolean not null default false,
  status payment_status not null default 'pending_verification',
  reference_no text,
  proof_path text,
  note text,
  verified_by uuid references profiles, verified_at timestamptz,
  created_by uuid not null references profiles,
  created_at timestamptz not null default now(),
  check ((is_refund and amount < 0) or (not is_refund and amount > 0)),
  check (method <> 'cash' or payment_account_id is null),
  check (method = 'cash' or payment_account_id is not null or is_refund)
)
```

Ada tabel tambahan `refunds` hanya jika diperlukan. Dalam spesifikasi ini refund cukup direpresentasikan oleh `payments` dengan `is_refund = true`.

### 7.6 Indeks wajib

- `orders (status, created_at)`, `orders (shift_id)`, `orders (bill_state) where bill_state = 'open'`
- `order_items (order_id)`, `payments (order_id)`, `payments (shift_id, method, status)`, `payments (created_at)`
- `stock_movements (inventory_item_id, created_at)`
- `audit_logs (entity, entity_id)`, `audit_logs (created_at)`

---

## 8. Keamanan dan RLS

### 8.1 Helper

```sql
create function current_role_type() returns role_type language sql stable security definer set search_path = public
  as $$ select role from profiles where id = auth.uid() and is_active $$;
create function is_staff() returns boolean language sql stable security definer set search_path = public
  as $$ select current_role_type() is not null $$;
create function is_super_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select current_role_type() = 'super_admin' $$;
```

### 8.2 Aturan akses per tabel

| Tabel | SELECT | INSERT/UPDATE/DELETE langsung |
|---|---|---|
| profiles | staff | tidak ada |
| store_settings | semua (anon juga, untuk layar masuk) | tidak ada |
| payment_accounts | staff | tidak ada |
| audit_logs | super_admin | tidak ada |
| categories, menu_items, modifier_*, recipe_lines | staff | tidak ada |
| inventory_items, stock_movements | staff | tidak ada |
| stock_opnames, stock_opname_lines | staff | tidak ada |
| shifts, orders, order_items, payments | staff | tidak ada |
| vouchers, voucher_redemptions | staff | tidak ada |
| daily_sequences | tidak ada | tidak ada |

Setiap tabel memiliki `enable row level security`. Semua `GRANT INSERT, UPDATE, DELETE` ke `anon` dan `authenticated` dicabut. Setiap fungsi `security definer` memakai `set search_path = public` dan dicabut `execute` dari `public` dan `anon`, lalu di-`grant` ke `authenticated`.

### 8.3 Aturan umum fungsi

- Baris pertama setiap RPC: pemeriksaan peran (`if not is_staff() then raise ... 'NOT_AUTHORIZED'`), atau `is_super_admin()` untuk operasi super admin.
- Input divalidasi ulang di database (rentang qty, format kode, nilai negatif).
- Pengunci: `for update` pada baris yang diubah (order, shift, voucher, inventory_items, shift).
- Setiap tindakan yang mengubah data penting menulis `audit_logs` dalam transaksi yang sama.

### 8.4 Keamanan lainnya

- Sesi Supabase: token refresh otomatis. Sesi kedaluwarsa setelah 8 jam tanpa aktivitas (dihitung di klien dan divalidasi ulang saat request berikutnya lewat RLS).
- Staff nonaktif: `is_active = false` membuat `current_role_type()` mengembalikan null, sehingga semua akses ditolak.
- Lockout login di klien: 5 kali gagal memicu 30 detik nonaktif. Ini hanya UX. Rate limit sebenarnya di Supabase Auth.
- Bukti bayar: bucket `payment-proofs` privat. Akses lewat signed URL 10 menit. Maks 5 MB. MIME yang diizinkan `image/jpeg`, `image/png`, `image/webp`. Staff boleh upload dan membaca.
- Logo: bucket `public-assets`, publik untuk dibaca, staff boleh upload, maks 1 MB, MIME `image/png`, `image/svg+xml`, `image/webp`.
- Input dari klien selalu divalidasi Zod sebelum dikirim dan ulang di database.
- Output HTML dari data pengguna (nama menu, catatan) hanya ditampilkan sebagai teks React. Dilarang `dangerouslySetInnerHTML`.

---

## 9. Katalog RPC

Semua RPC: `language plpgsql`, `security definer`, `set search_path = public`. Semua error memakai `raise exception using errcode = ..., message = '<KODE>'` (kode dari bagian 11).

| RPC | Peran | Argumen | Perilaku utama | Hasil |
|---|---|---|---|---|
| `open_shift` | staff | `p_opening_cash bigint` | Gagal jika ada shift terbuka. | `shifts` |
| `close_shift` | staff | `p_actual_cash bigint, p_note text` | Gagal jika ada open bill di shift. Hitung `expected_cash` sesuai D3, simpan selisih, tutup shift. | `shifts` |
| `create_order` | staff | `p_order_type, p_items jsonb, p_voucher_code text, p_table_label text, p_customer_name text, p_bill_mode text ('none'\|'open'), p_payments jsonb` | Validasi shift terbuka. Salin harga dan modifier. Kurangi stok sesuai resep. Hitung total. Terapkan voucher. Buat pembayaran jika `p_payments` tidak kosong dan bill_mode `none`. | `orders` |
| `add_items_to_open_bill` | staff | `p_order_id, p_items jsonb` | Hanya jika `bill_state = 'open'`. Kurangi stok. Hitung ulang total. | `orders` |
| `void_order_item` | staff | `p_item_id, p_reason text` | Hanya jika pesanan tidak `completed` dan tidak `cancelled`. Kembalikan stok (`void_return`). Hitung ulang. Terapkan D15. | `orders` |
| `cancel_order` | staff | `p_order_id, p_reason text` | Dari `new` atau `processing`. Kembalikan stok (`cancel_return`). Lepas voucher. Buat refund bila ada pembayaran `verified` (D5). | `orders` |
| `return_completed_order` | super_admin | `p_order_id, p_reason text` | Dari `completed` (D6). | `orders` |
| `change_order_status` | staff | `p_order_id, p_to_status` | Transisi valid saja (lihat 10.3). `completed` mengikuti D4. | `orders` |
| `apply_voucher` | staff | `p_order_id, p_code` | Hanya jika belum ada voucher. Validasi, hitung diskon, perbarui redemption. | `orders` |
| `remove_voucher` | staff | `p_order_id, p_reason` | Lepas voucher dan redemption. | `orders` |
| `submit_payment` | staff | `p_order_id, p_method, p_amount, p_payment_account_id, p_reference_no, p_proof_path, p_received_amount` | Lihat 10.6. Tunai langsung `verified`. | `payments` |
| `verify_payment` | staff | `p_payment_id, p_approve boolean, p_note text` | Hanya `pending_verification`. Tolak wajib beri `p_note`. | `payments` |
| `close_open_bill` | staff | `p_order_id, p_payments jsonb, p_voucher_code text` | Tutup bill, buat pembayaran. Gagal jika `p_payments` tidak menutup total (kecuali `pending_verification` diperbolehkan). Lepas `bill_state` menjadi `closed`. | `orders` |
| `open_stock_opname` | staff | - | Buat opname `draft` dan salin `system_qty`. Gagal jika sudah ada draft. | `stock_opnames` |
| `save_stock_opname_count` | staff | `p_opname_id, p_counts jsonb` | Batch simpan `counted_qty`. Gagal jika finalized. | `stock_opnames` |
| `finalize_stock_opname` | staff | `p_opname_id` | Buat movement `opname` untuk selisih, kunci opname. | `stock_opnames` |
| `record_stock_movement` | staff | `p_item_id, p_type ('purchase'\|'waste'\|'adjustment'), p_qty numeric, p_note text, p_allow_negative boolean` | Tidak boleh membuat stok negatif kecuali super admin dengan `p_allow_negative = true` dan catatan wajib (D16). | `stock_movements` |
| `upsert_menu_item` | staff | `p_item jsonb` | Insert atau update. Harga hanya lewat fungsi ini. | `menu_items` |
| `set_menu_item_available` | staff | `p_item_id, p_available boolean` | Toggle habis. | `menu_items` |
| `upsert_category` | staff | `p_category jsonb` | | `categories` |
| `upsert_recipe` | staff | `p_menu_item_id, p_lines jsonb` | Ganti seluruh resep item. | void |
| `upsert_inventory_item` | staff | `p_item jsonb` | Tanpa mengubah `current_qty` langsung. | `inventory_items` |
| `upsert_voucher` | staff | `p_voucher jsonb` | Edit tidak mengubah `used_count`. Kode tidak bisa diubah setelah dipakai. | `vouchers` |
| `set_voucher_active` | staff | `p_voucher_id, p_active boolean` | Nonaktifkan voucher yang sudah dipakai. | `vouchers` |
| `upsert_payment_account` | staff | `p_account jsonb` | | `payment_accounts` |
| `set_payment_account_active` | staff | `p_account_id, p_active boolean` | Tidak ada hapus permanen. | `payment_accounts` |
| `update_store_settings` | super_admin | `p_settings jsonb` | Validasi kontras warna. Tulis audit. | `store_settings` |
| `set_staff_role` | super_admin | `p_user_id, p_role` | Tolak self-change, tolak menurunkan super admin terakhir. | `profiles` |
| `set_staff_active` | super_admin | `p_user_id, p_active` | Tolak self-deactivation, tolak menonaktifkan super admin terakhir. | `profiles` |
| `get_sales_report` | staff | `p_from date, p_to date` | Lihat 10.8. | `jsonb` |

Setiap RPC penulisan wajib menulis `audit_logs` kecuali `get_sales_report`.

### 9.1 Format JSON input

- `p_items`: `[{"menu_item_id": uuid, "qty": int, "modifier_option_ids": [uuid], "note": text|null}]`
- `p_payments`: `[{"method": "cash"|"transfer"|"ewallet", "amount": int, "received_amount": int|null, "payment_account_id": uuid|null, "reference_no": text|null, "proof_path": text|null}]`
- `p_counts`: `[{"inventory_item_id": uuid, "counted_qty": numeric}]`
- `p_lines` (resep): `[{"inventory_item_id": uuid, "qty_per_serving": numeric}]`

Setiap field tidak dikenal menyebabkan `INPUT_INVALID`.

---

## 10. Aturan Bisnis

### 10.1 Harga dan perhitungan total

Urutan wajib, sama di SQL dan TypeScript (`shared/lib/money.ts`):

1. `line_total = (unit_price + sum(modifier.extra_price)) * qty`. Hanya item `is_voided = false`.
2. `subtotal = sum(line_total)`.
3. Diskon voucher:
   - persen: `discount = round_half_up(subtotal * value / 100)`, lalu `min(discount, max_discount)` jika `max_discount` diisi.
   - nominal: `discount = min(value, subtotal)`.
4. `base = subtotal - discount`.
5. `service_amount = round_half_up(base * service_percent / 100)`.
6. `tax_amount = round_half_up((base + service_amount) * tax_percent / 100)`.
7. `pre_round = base + service_amount + tax_amount`.
8. `rounded`:
   - `none`: `pre_round`
   - `up_100`: `ceil(pre_round / 100) * 100`
   - `nearest_100`: `floor((pre_round + 50) / 100) * 100`
9. `rounding_amount = rounded - pre_round`.
10. `grand_total = rounded`.

`round_half_up` untuk nilai positif: `floor(x + 0.5)`. Hasil selalu integer rupiah.

Harga menu hanya berubah lewat `upsert_menu_item`. Harga di `order_items` adalah snapshot.

### 10.2 Nomor pesanan

Format `JKG-YYYYMMDD-NNNN`. Tanggal dari `now() at time zone 'Asia/Jakarta'`. Nomor urut dari `daily_sequences` dengan `insert ... on conflict (day) do update set last_no = daily_sequences.last_no + 1 returning last_no`.

### 10.3 Transisi status pesanan

| Dari | Ke | Syarat |
|---|---|---|
| new | processing | Shift terbuka |
| processing | ready | - |
| ready | processing | Koreksi, tercatat audit |
| ready | completed | D4: `bill_state` tidak `open`, dan pembayaran `verified` ≥ `grand_total` jika `require_verified_payment = true` |
| new, processing | cancelled | Lewat `cancel_order` |
| completed | cancelled | Hanya lewat `return_completed_order` (super admin) |

Status `cancelled` adalah terminal. Transisi lain ditolak dengan `ORDER_STATUS_TRANSITION_INVALID`.

### 10.4 Open bill

1. `create_order` dengan `p_bill_mode = 'open'` membuat pesanan dengan `bill_state = 'open'`.
2. `add_items_to_open_bill` menambah item. Setiap item ditandai waktu penambahannya (`created_at`) agar dapur bisa melihat item baru.
3. `close_open_bill` mengunci pesanan (`for update`), menghitung total final dengan voucher opsional, memvalidasi bahwa pembayaran menutup total (pembayaran `pending_verification` diizinkan), lalu mengubah `bill_state = 'closed'` dan `closed_at = now()`.
4. Struk hanya bisa dicetak setelah `bill_state = 'closed'`.
5. `close_shift` menolak jika ada open bill di shift tersebut.

### 10.5 Void

- Void item: alasan wajib. Stok dikembalikan sesuai resep. Total dihitung ulang. Jika voucher tidak lagi memenuhi syarat, voucher dilepas (D15).
- Void tidak bisa dilakukan pada pesanan `completed` atau `cancelled`. Koreksi pesanan selesai hanya lewat retur.
- Item yang sudah di-void tidak bisa di-void lagi.

### 10.6 Pembayaran

| Metode | Status awal | Syarat |
|---|---|---|
| cash | `verified` | `received_amount ≥ amount`. `change_amount = received - amount`. |
| transfer, ewallet | `pending_verification` | `payment_account_id` aktif dan sesuai metode. `reference_no` wajib. `proof_path` opsional tetapi dianjurkan. |

Aturan umum:
- `amount` maksimal sama dengan sisa tagihan (`grand_total - sum(verified non-refund) - sum(pending non-refund)`). Melebihi sisa ditolak dengan `PAYMENT_EXCEEDS_OUTSTANDING`.
- Pembayaran `rejected` tidak dihitung dan tidak mengurangi sisa tagihan.
- `verify_payment` approve: status menjadi `verified`, `verified_by`, `verified_at`. Reject: status `rejected` dan `note` wajib.
- Refund hanya dibuat oleh sistem (cancel atau retur), dengan `is_refund = true` dan `amount` negatif, status `verified`, metode sama dengan pembayaran asal.

### 10.7 Shift

- Hanya satu shift terbuka pada satu waktu.
- `expected_cash = opening_cash + sum(payments.amount where method='cash' and status='verified' and shift_id = this)`. Refund tunai (negatif) ikut.
- `difference = actual_cash - expected_cash`.
- Setelah ditutup, shift tidak bisa diubah.

### 10.8 Laporan (`get_sales_report`)

Input tanggal lokal Jakarta, inklusif. Hanya memakai pembayaran `verified` (termasuk refund negatif, D1) dengan `created_at` dalam rentang (D2).

Output jsonb:
- `summary`: `totalSales` (sum amount, refund sudah ikut), `totalTransactions` (jumlah pesanan unik yang punya pembayaran dalam rentang), `avgTransaction` (`totalSales / totalTransactions`, dibulatkan), `totalRefund` (sum refund negatif, ditampilkan positif), `totalDiscount`, `totalService`, `totalTax`, `totalVoid` (sum line_total item void pada pesanan yang punya pembayaran dalam rentang).
- `daily[]`: `{date, totalSales, totalTransactions}`
- `hourly[]`: `{hour, totalSales, totalTransactions}`
- `byMethod[]`: `{method, totalSales}`
- `byCategory[]`: `{categoryName, totalQty, totalSales}` (D8)
- `byItem[]`: `{itemName, categoryName, totalQty, totalSales}` (D8)
- `byVoucher[]`: `{code, name, usageCount, totalDiscount}` untuk pesanan yang punya pembayaran dalam rentang dan `voucher_id` terisi.

Rentang tanggal maksimal 366 hari, selain itu `INPUT_INVALID`.

### 10.9 Stok

- Pengurangan stok saat item masuk pesanan (create, add to open bill), dengan `movement_type = 'sale'`, `reference_type = 'order_item'`.
- Pengembalian saat void (`void_return`) atau cancel (`cancel_return`), dan retur (`cancel_return`).
- Stok negatif ditolak kecuali D16.
- Stok diperiksa dan dikunci (`for update`) dalam transaksi yang sama.
- `current_qty` adalah cache. Ada fungsi verifikasi yang dijalankan di pgTAP: `current_qty = sum(qty_change)` untuk setiap bahan.

### 10.10 Voucher

Urutan validasi di `apply_voucher` dan `create_order`:
1. Kode ditemukan (uppercase, `trim`).
2. `is_active`.
3. `now()` dalam `valid_from` dan `valid_until`.
4. `used_count < total_quota` jika kuota diisi.
5. `subtotal >= min_subtotal`.

Satu pesanan hanya boleh satu voucher. Voucher `used_count` naik saat diterapkan, turun saat dilepas atau pesanan dibatalkan/diretur. Voucher yang sudah pernah dipakai tidak bisa dihapus.

### 10.11 Opname

1. `open_stock_opname` membuat draft dan menyalin `current_qty` ke `system_qty` untuk semua bahan aktif.
2. `save_stock_opname_count` menyimpan hitungan. Boleh disimpan berulang.
3. `finalize_stock_opname` menghasilkan movement `opname` untuk setiap `counted_qty - system_qty ≠ 0`, lalu mengunci. Selisih yang dihitung pada saat finalisasi, bukan `system_qty`, dipakai sebagai `qty_change = counted - current_qty_at_finalize`.
4. Opname finalized tidak bisa diubah. Hanya boleh satu draft pada satu waktu.

### 10.12 Audit

Tindakan yang wajib dicatat: `order.create`, `order.void_item`, `order.cancel`, `order.return`, `order.status_change`, `payment.submit`, `payment.verify`, `payment.refund`, `open_bill.close`, `shift.open`, `shift.close`, `voucher.create`, `voucher.update`, `voucher.deactivate`, `menu.update`, `menu.price_change`, `inventory.movement`, `opname.finalize`, `settings.update`, `staff.create`, `staff.role_update`, `staff.activate`, `staff.deactivate`, `payment_account.update`.

---

## 11. Kode Error dan Pesan

Kode di bawah dikirim sebagai `message` dari PostgreSQL atau `error` dari endpoint. Klien memetakan setiap kode ke `strings/id.ts` lewat `shared/lib/errors.ts`. Kode yang tidak dikenal ditampilkan sebagai "Terjadi kesalahan. Coba lagi." dan tetap dicatat ke Sentry.

| Kode | Arti |
|---|---|
| NOT_AUTHORIZED | Tidak punya hak |
| INPUT_INVALID | Input tidak valid |
| SHIFT_NOT_OPEN | Belum ada shift terbuka |
| SHIFT_ALREADY_OPEN | Sudah ada shift terbuka |
| SHIFT_NOT_FOUND | Shift tidak ditemukan |
| SHIFT_HAS_OPEN_BILL | Masih ada open bill di shift |
| ORDER_NOT_FOUND | Pesanan tidak ditemukan |
| ORDER_STATUS_TRANSITION_INVALID | Transisi status tidak diizinkan |
| ORDER_NOT_CANCELLABLE | Pesanan tidak bisa dibatalkan pada status ini |
| ORDER_NOT_RETURNABLE | Pesanan tidak bisa diretur |
| BILL_CLOSED | Open bill sudah ditutup |
| BILL_NOT_CLOSED | Bill belum ditutup |
| BILL_EMPTY | Pesanan kosong |
| MENU_ITEM_UNAVAILABLE | Menu tidak tersedia atau habis |
| ITEM_INVALID | Item tidak valid |
| ITEM_QUANTITY_INVALID | Jumlah item di luar 1 sampai 100 |
| ITEM_NOT_FOUND | Item tidak ditemukan |
| ITEM_ALREADY_VOIDED | Item sudah di-void |
| MODIFIER_INVALID | Pilihan modifier tidak sesuai aturan |
| STOCK_INSUFFICIENT | Stok bahan tidak cukup |
| VOUCHER_NOT_FOUND | Kode voucher tidak ditemukan |
| VOUCHER_INACTIVE | Voucher nonaktif |
| VOUCHER_NOT_STARTED | Voucher belum berlaku |
| VOUCHER_EXPIRED | Voucher sudah berakhir |
| VOUCHER_QUOTA_EXCEEDED | Kuota voucher habis |
| VOUCHER_MIN_SUBTOTAL | Belum memenuhi minimum belanja |
| VOUCHER_ALREADY_APPLIED | Pesanan sudah memakai voucher |
| PAYMENT_AMOUNT_INVALID | Nominal pembayaran tidak valid |
| PAYMENT_EXCEEDS_OUTSTANDING | Nominal melebihi sisa tagihan |
| PAYMENT_ACCOUNT_INVALID | Rekening tidak aktif atau tidak sesuai metode |
| PAYMENT_NOT_FOUND | Pembayaran tidak ditemukan |
| PAYMENT_NOT_PENDING | Pembayaran sudah diverifikasi atau ditolak |
| PAYMENT_NOT_VERIFIED | Pembayaran belum lunas atau belum terverifikasi |
| CASH_RECEIVED_INSUFFICIENT | Uang diterima kurang dari nominal |
| REASON_REQUIRED | Alasan wajib diisi |
| OPNAME_FINALIZED | Opname sudah difinalisasi |
| OPNAME_NOT_FOUND | Opname tidak ditemukan |
| OPNAME_ALREADY_DRAFT | Masih ada opname draft |
| STAFF_NOT_FOUND | Staff tidak ditemukan |
| SELF_ROLE_CHANGE_FORBIDDEN | Tidak boleh mengubah peran sendiri |
| SELF_DEACTIVATION_FORBIDDEN | Tidak boleh menonaktifkan diri sendiri |
| LAST_SUPER_ADMIN | Tidak boleh menurunkan atau menonaktifkan super admin terakhir |
| SETTINGS_INVALID | Pengaturan tidak valid |
| CONTRAST_TOO_LOW | Kontras warna di bawah standar |
| STAFF_EMAIL_EXISTS | Email sudah terdaftar |
| SERVER_NOT_CONFIGURED | Konfigurasi server belum lengkap |

---

## 12. Frontend React

### 12.1 Aplikasi dan provider

- `main.tsx` memasang `Sentry` (jika DSN ada), lalu `App`.
- `providers.tsx` berisi `QueryClientProvider`, `SessionProvider` (membaca sesi Supabase dan memanggil `onAuthStateChange`), `ThemeProvider`, dan `Toaster`.
- `QueryClient` default: `staleTime` 30 detik, `retry` 1 kali untuk query dan 0 untuk mutasi, `refetchOnWindowFocus` true.

### 12.2 Routing

| Path | Peran | Layout |
|---|---|---|
| `/login` | publik | Kosong |
| `/pos` | staff | PosLayout |
| `/pos/open-bill/:orderId` | staff | PosLayout |
| `/orders` | staff | AppShell |
| `/orders/:orderId` | staff | AppShell |
| `/history` | staff | AppShell |
| `/shift` | staff | AppShell |
| `/menu` | staff | AppShell |
| `/inventory` | staff | AppShell |
| `/inventory/opname` | staff | AppShell |
| `/inventory/opname/:opnameId` | staff | AppShell |
| `/vouchers` | staff | AppShell |
| `/payment-accounts` | staff | AppShell |
| `/payment-verification` | staff | AppShell |
| `/reports` | staff | AppShell |
| `/settings` | super_admin | AppShell |
| `/settings/branding` | super_admin | AppShell |
| `/settings/staff` | super_admin | AppShell |
| `/settings/printer` | staff | AppShell |
| `/audit` | super_admin | AppShell |
| `/403` | publik | AppShell |
| `*` | publik | Kosong |

Semua route kecuali `/login` memakai `lazy`. `RequireAuth` mengarahkan ke `/login` jika tidak ada sesi. `RequireRole` menampilkan `/403` jika peran tidak cocok. Setelah login: jika ada shift terbuka, ke `/pos`; jika tidak, ke `/shift`.

Menu sidebar hanya menampilkan item yang diizinkan peran. Kesalahan peran di sisi UI tidak menggantikan RLS.

### 12.3 Data layer

- Semua pemanggilan Supabase berada di `features/*/api.ts`.
- Query: `useQuery({ queryKey, queryFn })` dengan key berbentuk array `['orders', { status, from, to }]`.
- Mutasi: `useMutation` yang memanggil RPC, lalu `invalidateQueries` untuk key terkait. Dilarang update optimistik untuk transaksi uang. Toggle sederhana (`is_available`) boleh optimistik dengan rollback.
- Setiap error dari `api.ts` berbentuk `AppError` dengan `code`. Tidak ada `try/catch` di komponen.
- Timeout request 15 detik lewat `AbortSignal.timeout`. Setelah timeout, pesan "Koneksi lambat, coba lagi." dan tombol aktif kembali.

### 12.4 State lokal (Zustand)

| Store | Isi | Persist |
|---|---|---|
| `cartStore` | item, modifier, catatan, voucher kode, tipe pesanan, nomor meja | localStorage `jokger.cart.v1` |
| `deviceStore` | pairing printer (nama, id), ukuran kertas lokal, mode shortcut aktif | localStorage `jokger.device.v1` |
| `themeStore` | `light`, `dark`, `system` | localStorage `jokger.theme.v1` |

Keranjang dihapus setelah pesanan berhasil dibuat. Tidak ada token atau data transaksi di localStorage.

### 12.5 Form

- React Hook Form dengan `zodResolver`. Skema Zod berada di `features/*/schemas.ts` dan dipakai ulang di `api/` untuk validasi sebelum kirim.
- Error ditampilkan di bawah field dengan `aria-describedby`. Submit pertama kali memfokuskan field pertama yang salah.
- Form dengan perubahan belum disimpan memunculkan konfirmasi saat meninggalkan halaman (`useBlocker`).

### 12.6 Komponen UI

Komponen shadcn/ui yang wajib tersedia di `shared/ui`: Button, Input, Label, Textarea, Select, Checkbox, RadioGroup, Switch, Dialog, AlertDialog, Sheet, DropdownMenu, Tabs, Tooltip, Toast (Sonner), Table, Badge, Card, Skeleton, Separator, Popover, Command (combobox), Calendar (Date range).

Komponen aplikasi di `shared/components`:
- `Money`: menampilkan integer rupiah dengan `Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits: 0})`, angka tabular, negatif dengan warna danger.
- `StatusBadge`: order, payment, shift. Selalu ada ikon dan teks.
- `DataTable`: sort, pilihan baris, header sticky, pada layar sempit berubah menjadi kartu.
- `ConfirmAction`: dialog konfirmasi destruktif dengan textarea alasan bila `requireReason`.
- `NumericKeypad`: untuk input uang di tablet.
- `OfflineBanner`, `PrinterStatus`, `ShiftBadge`.
- `EmptyState`, `ErrorState` dengan tombol coba lagi.

### 12.7 Tema dan branding

- Token warna di `:root` sebagai CSS variables: `--brand`, `--brand-contrast`, `--brand-hover`, `--accent`, `--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--success`, `--warning`, `--danger`, `--info`.
- Mode gelap lewat kelas `dark` pada `<html>`.
- Warna brand dari `store_settings` diterapkan dengan `document.documentElement.style.setProperty`. Warna turunan dihitung di `shared/lib/contrast.ts`.
- Validasi kontras WCAG AA dijalankan di klien sebelum simpan dan di RPC `update_store_settings`. Teks normal minimal 4,5:1, teks besar minimal 3:1.
- Font: `font_family` dipetakan ke paket `@fontsource`. Hanya font yang dipilih yang di-import (dynamic import). Perubahan font mengatur `--font-family`.
- Logo: `logo_url` dipakai di header, layar masuk, dan struk.

### 12.8 Realtime

Hook `useRealtime({ table, filter, onChange })` di `shared/hooks`:
- Membuat channel `realtime:<table>:<filter>` saat mount.
- Memanggil `onChange` untuk setiap event.
- `useEffect` cleanup memanggil `supabase.removeChannel(channel)`.
- Dipakai di:
  - Pesanan: `orders` dengan `status` tidak `completed` dan tidak `cancelled`. `onChange` memicu `invalidateQueries(['orders'])`.
  - Verifikasi pembayaran: `payments` dengan `status = 'pending_verification'`.
- Status koneksi realtime ditampilkan di header. Jika terputus, halaman tetap memakai refetch saat fokus jendela.

---

## 13. Layar dan Perilaku

### 13.1 Login
- Email dan password. Pesan error umum. Lockout 5 kali gagal, 30 detik, dengan hitung mundur.
- Menampilkan nama dan logo toko dari `store_settings` (anon boleh membaca).

### 13.2 AppShell
- Header: logo dan nama toko, nama dan peran staff, badge shift (terbuka dengan jam buka, atau tertutup), status koneksi, status printer, menu profil (tema, keluar).
- Sidebar di desktop (≥1024 px), dapat diciutkan. Bottom navigation di mobile (<768 px) dengan lima item utama dan menu "Lainnya".
- Badge jumlah: pesanan aktif, pembayaran menunggu verifikasi, bahan menipis.

### 13.3 POS (`/pos`)
Tata letak tablet landscape: kategori dan grid menu di kiri, keranjang di kanan. Di bawah 1024 px, keranjang menjadi bottom sheet dengan ringkasan (jumlah item dan total).

- Kategori sebagai tab horizontal yang bisa digeser. Pencarian menu di atas grid.
- Kartu menu: gambar (rasio 4:3, lazy), nama, harga, badge "Habis". Item habis tidak bisa dipilih.
- Ketuk kartu menambah satu porsi. Jika item punya modifier, panel modifier terbuka dulu. Modifier wajib dengan `min_select` harus terpenuhi sebelum tombol tambah aktif.
- Keranjang: baris item dengan modifier, catatan, jumlah (`−` dan `+` 44 px), total baris, hapus dengan konfirmasi singkat (toast undo 5 detik).
- Voucher: input kode (uppercase saat diketik), tombol Terapkan, chip voucher yang bisa dihapus. Validasi lokal tampilan, validasi final di server.
- Ringkasan: subtotal, diskon, layanan, pajak, pembulatan, total. Memakai `calculateTotals` yang sama dengan server. Jika server mengembalikan total berbeda saat checkout, keranjang menampilkan peringatan dan meminta konfirmasi ulang.
- Pembayaran (drawer):
  - Tunai: tombol nominal cepat (uang pas, 50.000, 100.000, 150.000). Kembalian besar. Konfirmasi jika uang diterima lebih dari 10 kali total.
  - Transfer dan e-wallet: pilih rekening aktif, tampilkan nomor dengan tombol salin, input referensi, unggah bukti (validasi ukuran dan format di klien).
  - Split: beberapa baris pembayaran, sisa tagihan terlihat terus.
- Setelah berhasil: layar sukses dengan nomor pesanan besar, tombol Pesanan baru (fokus), Cetak ulang, Lihat pesanan.
- Pintasan keyboard: `/` pencarian, `1`–`9` memilih item yang terlihat, `F2` pembayaran, `F3` open bill, `F4` voucher, `Esc` tutup drawer. Pintasan bisa dimatikan di pengaturan perangkat.
- Pembuatan pesanan memblokir klik ganda dan menampilkan indikator di tombol.

### 13.4 Open bill (`/pos/open-bill/:orderId`)
- Header: nomor pesanan, meja atau pelanggan, waktu buka, total sementara.
- Kiri: menu dengan tombol Tambah ke bill. Kanan: item bill dikelompokkan per waktu penambahan. Item yang sudah masuk dapur ditandai "Dikirim".
- Tutup bill membuka drawer pembayaran dengan total final, voucher opsional, dan split.
- Bill tertutup menjadi tampilan baca saja.

### 13.5 Pesanan (`/orders`)
- Tab: Semua, Baru, Diproses, Menunggu diambil, Selesai, Dibatalkan. Setiap tab menampilkan jumlah.
- Filter: tipe, open bill, rentang tanggal, kasir.
- Desktop: papan kolom untuk Baru, Diproses, Menunggu diambil. Mobile: daftar kartu dengan tab.
- Kartu: nomor, meja atau nama, jumlah item, waktu sejak dibuat (diperbarui tiap menit), badge status. Lebih dari 15 menit di status Baru diberi penanda warning.
- Aksi cepat sesuai transisi valid (Proses, Siap, Selesai).
- Detail pesanan (panel samping atau halaman): item termasuk void, pembayaran dengan bukti, riwayat status, dan aksi Cetak ulang, Void item, Batalkan, Retur (super admin). Aksi destruktif memakai `ConfirmAction` dengan alasan wajib.
- Realtime aktif sesuai 12.8.

### 13.6 Riwayat (`/history`)
- Tabel dengan kolom: nomor, waktu, tipe, ringkasan item, metode, total, status, kasir.
- Filter: rentang tanggal dengan preset (hari ini, kemarin, 7 hari, bulan ini), status, metode, kasir, tipe, pencarian nomor.
- Ringkasan di atas tabel dari hasil filter.
- Detail lengkap dalam drawer. Ekspor CSV untuk hasil filter.
- Pagination 25 baris, pilihan 50 dan 100. Tanpa infinite scroll.

### 13.7 Shift (`/shift`)
- Tanpa shift terbuka: kartu buka kasir dengan saldo awal.
- Shift terbuka: ringkasan real-time (jumlah pesanan, total per metode, kas yang diharapkan).
- Tutup kasir dua langkah: ringkasan, lalu input kas fisik. Selisih tampil dengan teks ("Kurang Rp 5.000", "Pas", "Lebih Rp 2.000"). Tombol tutup nonaktif jika ada open bill, dengan penjelasan.
- Riwayat shift dengan selisih dan tombol cetak ringkasan.

### 13.8 Menu (`/menu`)
- Dua kolom: kategori dan item. Urutan diatur dengan seret atau tombol panah.
- Form item: nama, deskripsi, kategori, harga, gambar (dikompres di browser ke maks 800 px, lalu unggah), status aktif, status tersedia, modifier, resep.
- Resep: tabel bahan dengan jumlah per porsi, validasi > 0.
- Toggle "Habis" cepat.
- Hapus item = nonaktifkan.

### 13.9 Inventaris (`/inventory`)
- Tabel bahan: nama, satuan, stok, stok minimum, nilai stok, status (aman, menipis, habis).
- Aksi: pembelian, waste, penyesuaian (dengan alasan). Riwayat pergerakan per bahan dengan tautan ke referensi.
- Stok negatif: tombol hanya untuk super admin, dengan konfirmasi ketik ulang nama bahan.

### 13.10 Opname (`/inventory/opname`)
- Daftar opname dengan status draft dan finalized.
- Halaman detail: kolom bahan, stok sistem (baca saja), stok hitung (input numerik), selisih otomatis. Enter pindah ke baris berikutnya.
- Simpan otomatis dengan indikator "Menyimpan…" dan "Tersimpan".
- Filter: hanya selisih, belum dihitung.
- Finalisasi: ringkasan selisih, lalu ketik ulang kata `FINALISASI`. Setelah itu halaman baca saja dengan banner.

### 13.11 Voucher (`/vouchers`)
- Daftar: kode, nama, tipe, nilai, periode, pemakaian per kuota, status, aksi.
- Form dengan pratinjau: contoh belanja Rp 100.000 dan potongan yang dihitung.
- Kode bisa dibuat otomatis. Validasi keunikan asinkron dengan debounce 300 ms.
- Voucher yang pernah dipakai: tombol Hapus berubah menjadi Nonaktifkan.
- Laporan pemakaian per voucher di tab terpisah.

### 13.12 Rekening (`/payment-accounts`)
- Kartu rekening: penyedia, pemilik, nomor (masked di daftar), status, urutan.
- Form dengan validasi nomor (hanya angka).
- Nonaktifkan, bukan hapus.

### 13.13 Verifikasi pembayaran (`/payment-verification`)
- Antrian `pending_verification`, paling lama di atas.
- Layar dua kolom: bukti (zoom, putar, buka di tab baru) dan detail (nomor pesanan, nominal, rekening tujuan, referensi, waktu).
- Setujui dan Tolak. Tolak wajib alasan.
- Pintasan: `A` setujui, `R` tolak, panah atas dan bawah pindah antrian.
- Bukti tidak tersedia: tampil "Bukti belum dilampirkan", verifikasi tetap bisa dengan catatan.

### 13.14 Laporan (`/reports`)
- Pilih rentang tanggal dengan preset. Tombol terapkan memanggil `get_sales_report`.
- Kartu ringkasan: total penjualan, transaksi, rata-rata, refund, diskon, layanan dan pajak, void.
- Tab: Per hari, Per jam, Metode, Kategori, Item, Voucher.
- Setiap grafik (SVG sederhana) disertai tabel data dan tombol unduh CSV.
- Baris "Diskon voucher" ditampilkan di tab Item sesuai D8.

### 13.15 Pengaturan (`/settings`, `/settings/branding`, `/settings/staff`)
- Umum: identitas toko, pajak, layanan, pembulatan, `require_verified_payment`, jam buka (tampilan).
- Branding: logo (pratinjau di header, login, struk), warna dengan rasio kontras dan status lulus atau gagal, font dengan pratinjau. Tombol Batal kembali ke nilai tersimpan.
- Struk: header, footer, ukuran kertas.
- Staff: tabel dengan nama, email, peran, status. Tambah staff lewat dialog (email, nama, peran awal, password sementara). Ubah peran dan nonaktifkan dengan konfirmasi. Super admin tidak bisa mengubah diri sendiri.

### 13.16 Printer (`/settings/printer`)
- Status: terhubung, tidak terhubung, tidak didukung.
- Hubungkan printer (Web Bluetooth), Cetak uji, ukuran kertas perangkat, jumlah salinan default.
- Jika browser tidak mendukung Web Bluetooth, halaman menjelaskan batasan dan mengaktifkan mode cetak browser.

### 13.17 Audit (`/audit`)
- Tabel dengan filter tindakan, aktor, entitas, rentang tanggal.
- Payload ditampilkan sebagai daftar pasangan kunci-nilai yang mudah dibaca.
- Hanya baca.

### 13.18 Riwayat untuk sesi dan keamanan UI
- Halaman 403 dengan tombol kembali ke halaman utama peran tersebut.
- Halaman 404 dengan tautan ke POS atau Pesanan.

---

## 14. Cetak Struk

- Builder: `shared/lib/receipt.ts` memakai `@point-of-sale/receipt-printer-encoder` dengan codepage yang didukung printer, lebar 58 mm (384 dot) atau 80 mm (576 dot).
- Isi struk berurutan: logo (raster monokrom), nama toko, alamat, telepon, header, garis, nomor pesanan, tanggal dan jam, meja atau pelanggan, item dengan modifier dan catatan dan jumlah, subtotal, diskon voucher (dengan kode), layanan, pajak, pembulatan, total, rincian pembayaran, kembalian, footer, QR nomor pesanan.
- Transport Web Bluetooth: pilih perangkat, cari service dan characteristic write, kirim per potongan 100 byte dengan jeda 20 ms.
- Antrian cetak lokal (`localStorage`, maks 20 pekerjaan) untuk pekerjaan yang gagal. Antrian diproses ulang saat printer tersambung.
- Cetak ulang diberi tanda REPRINT dan tidak mengubah data transaksi.
- Pencetakan tidak pernah memblokir penyimpanan transaksi. Transaksi sudah tersimpan sebelum cetak.
- Fallback: `window.print()` dengan stylesheet `@media print` yang memakai lebar kertas perangkat. Dipakai jika Web Bluetooth tidak tersedia atau pengguna memilih mode ini.

---

## 15. Aksesibilitas, Responsivitas, dan Performa

### 15.1 Aksesibilitas (WCAG 2.1 AA)
- Navigasi keyboard penuh. Urutan fokus sesuai urutan visual. Indikator fokus 2 px dengan offset 2 px.
- Skip link "Lewati ke konten utama" di setiap halaman.
- Satu `h1` per halaman. Landmark `header`, `nav`, `main`, `aside`.
- Setiap field berlabel. Error diumumkan lewat `aria-live`.
- Tabel dengan `th scope`, caption untuk tabel data.
- Target sentuh minimal 44×44 px, jarak antar target minimal 8 px.
- Status tidak hanya warna: selalu ada ikon dan teks.
- Layout tetap berfungsi pada zoom 200%.
- Modal dan drawer menjebak fokus dan mengembalikan fokus ke pemicu.
- Hormati `prefers-reduced-motion`.
- Axe dijalankan di setiap halaman utama pada tema terang dan gelap.

### 15.2 Responsivitas
| Breakpoint | Lebar | Perilaku |
|---|---|---|
| Mobile | <768 px | Bottom navigation, tabel jadi kartu, keranjang jadi bottom sheet, drawer penuh layar |
| Tablet | 768–1023 px | Bottom navigation dengan label, POS dua kolom |
| Desktop | ≥1024 px | Sidebar, POS tiga area |
| Layar besar | ≥1440 px | Grid menu lebih lebar |

POS dioptimalkan untuk tablet landscape. Dalam potret, POS menampilkan saran rotasi tetapi tetap berfungsi. Mobile-first dengan Tailwind.

### 15.3 Performa
| Metrik | Target |
|---|---|
| LCP halaman POS (build production, mobile emulasi, login dilakukan) | di bawah 2,5 detik |
| Skor Lighthouse performa POS dan Pesanan | minimal 85 |
| JavaScript awal (gzip) | di bawah 180 KB |
| Chunk per route (gzip) | di bawah 80 KB |
| CLS | di bawah 0,05 |
| INP tambah item dan tombol utama | di bawah 200 ms |

Teknik: route-level lazy, `React.memo` dan `useMemo` untuk daftar besar, virtualisasi untuk riwayat dan audit (lebih dari 200 baris), gambar menu dengan `loading="lazy"` dan dimensi eksplisit, ikon diimpor per nama, tanpa library grafik besar.

---

## 16. Logging, Observabilitas, dan Error

- Modul logger tunggal `shared/lib/logger.ts`. Dilarang `console.log`. `console.error` hanya di logger.
- Sentry di klien dan fungsi serverless. `beforeSend` menghapus email, nomor rekening, nomor telepon, token, dan nilai dari form.
- Error boundary di level route dengan pesan Bahasa Indonesia dan tombol muat ulang.
- Alert: error rate klien melebihi 2% dalam 15 menit, atau fungsi serverless gagal lebih dari 10 kali berturut-turut. Dikonfigurasi di Sentry dan dicatat sebagai langkah manual.
- Vercel Analytics untuk Web Vitals.

---

## 17. Pengujian

### 17.1 Lapisan

| Lapisan | Alat | Cakupan wajib | Ambang |
|---|---|---|---|
| Unit logika | Vitest | `shared/lib/money.ts`, `contrast.ts`, `receipt.ts`, `errors.ts`, `csv.ts`, semua `logic.ts` | Baris 90%, cabang 80% |
| Komponen | Vitest + Testing Library | Semua komponen `shared/ui` dan `shared/components`, form utama, POS, verifikasi | Lulus semua test |
| Hook | Vitest | `useRealtime`, `useShortcut`, store Zustand | Lulus |
| Database | pgTAP (`supabase test db`) | Setiap RPC: nilai kembali, setiap kode error, RLS per peran, atomisitas | 100% RPC tercakup |
| Konsistensi skema | pgTAP | `current_qty = sum(qty_change)` per bahan, tidak ada stok negatif, `expected_cash` sama dengan jumlah pembayaran tunai, laporan = pembayaran verified | Lulus |
| E2E | Playwright | Lihat 17.3 | Lulus di Chromium, Firefox, WebKit, dan dua viewport mobile |
| Aksesibilitas | @axe-core/playwright | Semua route utama | Nol pelanggaran serius atau kritis |
| Performa | Lighthouse CI | `/login`, `/pos`, `/orders` (lihat D14) | Skor performa minimal 85 |
| Keamanan | gitleaks, `pnpm audit --audit-level=high`, pemeriksaan bundle | Seluruh repo dan bundle | Nol temuan |

### 17.2 Test database wajib (pgTAP)

Setiap item di bawah wajib memiliki assertion:
1. `create_order` menghitung total sesuai 10.1 untuk kombinasi: tanpa pajak, pajak saja, layanan dan pajak, pembulatan `up_100` dan `nearest_100`, voucher persen dengan dan tanpa `max_discount`, voucher nominal.
2. Pesanan tanpa shift terbuka ditolak (`SHIFT_NOT_OPEN`).
3. Dua shift terbuka ditolak (unique index).
4. `close_shift` menolak jika ada open bill (`SHIFT_HAS_OPEN_BILL`).
5. `expected_cash` mencakup pembayaran tunai verified, mengecualikan transfer dan pending, mengurangi refund tunai.
6. Laporan `get_sales_report` sama dengan jumlah pembayaran verified pada rentang yang sama, termasuk refund negatif, dan mengecualikan pembayaran rejected.
7. Pesanan dibatalkan setelah pembayaran tunai menghasilkan refund negatif, stok kembali, dan voucher terlepas.
8. Retur pesanan selesai hanya oleh super admin.
9. `void_order_item` menghitung ulang total, mengembalikan stok, dan melepas voucher jika minimum tidak lagi terpenuhi (D15).
10. Item void tidak bisa di-void lagi.
11. Transisi status tidak valid ditolak. `completed` tanpa lunas ditolak. `completed` lunas diterima. Jika `require_verified_payment = false`, `completed` tanpa lunas diterima.
12. Pembayaran transfer tanpa `payment_account_id` ditolak. Rekening nonaktif ditolak. Pembayaran melebihi sisa ditolak.
13. Tunai dengan `received_amount` kurang ditolak. Kembalian dihitung dengan benar.
14. `verify_payment` reject tanpa catatan ditolak. Verifikasi dua kali ditolak (`PAYMENT_NOT_PENDING`).
15. Stok tidak cukup menolak pesanan dan tidak mengubah stok apa pun (atomisitas).
16. Stok negatif hanya diizinkan untuk super admin dengan `p_allow_negative`.
17. Opname: finalisasi menghasilkan movement selisih tepat, dan opname finalized tidak bisa diubah.
18. Voucher: kuota habis, kedaluwarsa, belum mulai, minimum belanja, satu voucher per pesanan, nonaktif.
19. Nomor pesanan naik per hari dan reset per hari Jakarta. Dua pemanggilan paralel menghasilkan nomor berbeda.
20. `set_staff_role`: admin ditolak, self-change ditolak, super admin terakhir dilindungi, audit tercatat.
21. `set_staff_active`: admin ditolak, self-deactivation ditolak, super admin terakhir dilindungi.
22. RLS: role `authenticated` tidak bisa `insert`, `update`, atau `delete` pada tabel operasional, profiles, dan payment_accounts. `anon` hanya bisa membaca `store_settings`.
23. Staff nonaktif tidak bisa membaca data operasional.
24. Audit log tidak bisa diubah atau dihapus oleh siapa pun.

### 17.3 E2E wajib (Playwright)

Setiap skenario memakai seed terpisah. Database direset sebelum suite.
1. Login admin, lalu super admin. Login salah lima kali memunculkan lockout.
2. Admin membuka `/settings/staff` dan melihat halaman 403.
3. Buka shift, buat pesanan tunai, selesaikan, dan cetak struk (mock printer).
4. Pesanan transfer: buat dengan bukti, verifikasi di layar verifikasi, lalu selesaikan.
5. Open bill: buka, tambah item dua kali, tutup dengan split tunai dan transfer, struk hanya keluar setelah tutup.
6. Void item dengan alasan, stok kembali (dicek di inventaris).
7. Batalkan pesanan yang sudah dibayar tunai, refund tercatat.
8. Tutup shift dengan selisih kurang, selisih tampil benar.
9. Stok opname: buka, isi hitungan, finalisasi dengan ketik ulang kata.
10. Buat voucher, terapkan di POS, total sesuai.
11. POS hanya dengan keyboard: pilih item, terapkan voucher, bayar tunai.
12. Tema gelap dan terang pada POS.
13. Viewport 768 px: keranjang bottom sheet dapat dibuka dan ditutup.
14. Koneksi putus saat pembayaran (`context.setOffline(true)`): tombol bayar nonaktif, pesan muncul, pembayaran tidak tercatat ganda saat koneksi kembali.
15. Realtime: pesanan baru dari tab kedua muncul di tab Pesanan tanpa muat ulang.
16. Super admin mengubah branding, warna kontras rendah ditolak.
17. Ekspor CSV riwayat dan laporan menghasilkan file dengan jumlah baris yang benar.

### 17.4 Lighthouse (D14)

`lighthouserc.cjs` memakai `puppeteerScript` yang login dengan `E2E_ADMIN_EMAIL` lalu memberi jalur ke `/pos` dan `/orders`. Target: `vite preview` dari build production. Skor performa minimal 85 pada profil mobile.

### 17.5 Data uji

- `supabase/seed.sql` berisi kategori, menu, modifier, bahan, resep, rekening, dan pengaturan default.
- Akun uji (hanya local dan staging): satu admin dan satu super admin, dibuat oleh skrip seed lewat Supabase Auth admin API.
- Dilarang seed akun uji di production.

---

## 18. CI/CD

### 18.1 Pipeline pull request dan push ke main

Berurutan, semua wajib hijau:
1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm format:check`
4. `pnpm typecheck` (web dan api)
5. `pnpm test:unit` dengan coverage dan ambang
6. `supabase start`
7. `supabase db reset` (menjalankan semua migrasi dan seed)
8. `supabase test db`
9. `pnpm db:types` lalu `git diff --exit-code -- apps/web/src/shared/types/database.ts` (format sudah dilakukan di skrip `db:types` dengan `prettier --write`)
10. `pnpm build`
11. Pemeriksaan bundle: gagal jika `dist/` memuat `SUPABASE_SERVICE_ROLE_KEY` atau `service_role`
12. `pnpm --filter @jokger/web exec playwright install --with-deps chromium firefox webkit`
13. `pnpm --filter @jokger/web test:e2e`
14. `pnpm exec lhci autorun`
15. `pnpm audit --audit-level=high`
16. gitleaks

Artefak yang diunggah: laporan Playwright, laporan coverage, laporan Lighthouse.

### 18.2 Skrip package.json root (wajib ada)

`dev`, `build`, `lint`, `format`, `format:check`, `typecheck`, `test`, `test:unit`, `test:e2e`, `db:start`, `db:reset`, `db:test`, `db:types`, `db:push`, `api:typecheck`.

Nama filter pnpm harus memakai nama package penuh: `--filter @jokger/web`.

### 18.3 Deploy

- Preview deployment Vercel untuk setiap pull request dengan proyek Supabase staging.
- Merge ke `main`: deploy staging otomatis, migrasi staging dijalankan lebih dulu (`supabase db push`).
- Tag `v*.*.*`: deploy production setelah persetujuan manual di environment GitHub. Migrasi production dijalankan dengan `supabase db push` sebelum deploy aplikasi.
- Migrasi harus kompatibel mundur satu versi aplikasi (expand lalu contract).
- Rollback aplikasi: redeploy versi sebelumnya dari Vercel. Rollback database: migrasi perbaikan baru.

### 18.4 Backup

- Point-in-time recovery aktif di production.
- Ekspor logis harian ke bucket terpisah.
- RPO maksimal 5 menit, RTO maksimal 2 jam.
- Prosedur pemulihan diuji minimal sekali sebelum go-live dan dicatat hasilnya.

---

## 19. Urutan Implementasi

Ini adalah urutan kerja AI coding agar setiap langkah bisa diverifikasi. Ini bukan fase produk, dan semua bagian wajib selesai sebelum dianggap siap deploy.

1. Scaffold monorepo, konfigurasi TypeScript, lint, format, hooks git, CI kerangka.
2. Skema database, RLS, dan migrasi awal sampai berjalan dari database kosong.
3. Helper dan fungsi logika uang (`money.ts`) dengan unit test.
4. RPC shift, pesanan, pembayaran, voucher, dan pgTAP untuk masing-masing.
5. RPC stok, opname, menu, inventaris, dan pgTAP.
6. RPC staff, pengaturan, rekening, dan audit, dan pgTAP.
7. RPC laporan dan pgTAP.
8. Seed dan pemeriksaan konsistensi skema.
9. Klien Supabase, auth, session, dan route guard.
10. Komponen UI dasar dan tema, dengan test komponen.
11. Layar POS dan open bill, dengan test komponen dan E2E.
12. Layar pesanan dan realtime.
13. Layar shift, riwayat, dan cetak struk.
14. Layar menu, inventaris, opname, voucher, rekening, dan verifikasi.
15. Layar laporan, pengaturan, branding, staff, printer, dan audit.
16. Endpoint `/api/admin/create-staff` dengan test.
17. Axe, Lighthouse, dan E2E lengkap sesuai 17.3.
18. Pemeriksaan bundle, audit dependensi, gitleaks, dan verifikasi kriteria di bagian 20.

Setelah setiap langkah, jalankan perintah terkait dan pastikan hijau sebelum lanjut.

---

## 20. Definisi Selesai (Acceptance)

Produk dinyatakan siap deployment jika seluruh poin berikut terpenuhi dan dibuktikan dengan output perintah:

1. `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `supabase db reset`, `supabase test db`, dan `pnpm test:e2e` semuanya hijau.
2. Migrasi dari database kosong berjalan tanpa error. Seed berjalan tanpa error.
3. Semua RPC di bagian 9 ada, memakai nama dan signature yang sama, dan lulus pgTAP.
4. Tidak ada penulisan langsung ke tabel dari klien (diverifikasi dengan pencarian kode `.insert(`, `.update(`, `.upsert(`, `.delete(` pada `.from(`).
5. Tidak ada float untuk uang (diverifikasi dengan pencarian tipe `number` untuk nilai uang yang tidak dibungkus fungsi integer).
6. Admin tidak bisa mengakses halaman super admin, baik lewat navigasi maupun URL langsung, dan RLS menolak akses data.
7. Kasir tidak bisa membuat pesanan sebelum shift dibuka.
8. Pesanan tunai selesai dalam enam ketukan atau kurang dari pilihan item pertama hingga struk.
9. Pesanan transfer bisa dibuat dengan bukti, diverifikasi, dan diselesaikan. Pesanan belum lunas tidak bisa selesai jika D4 aktif.
10. Open bill bisa dibuka, ditambah item berkali-kali, ditutup dengan split payment, dan struk hanya keluar setelah ditutup.
11. Voucher persen dan nominal dibuat dan diterapkan dengan kuota, periode, dan minimum belanja yang benar.
12. Void item dan pembatalan mengembalikan stok dan total dengan benar. Refund tercatat untuk pesanan yang sudah dibayar.
13. Stok berkurang sesuai resep saat pesanan dibuat dan kembali saat dibatalkan atau di-void.
14. Opname menghasilkan movement selisih yang tepat dan tidak bisa diubah setelah finalisasi.
15. Laporan penjualan dan selisih kas shift konsisten sesuai D1 sampai D3, dibuktikan dengan pgTAP dan E2E.
16. Selisih tutup kasir ditampilkan dengan benar.
17. Struk tercetak dengan benar di printer termal 58 mm dan 80 mm pada Chrome Android dan Windows. Fallback cetak browser berfungsi di Safari iOS.
18. Perubahan branding (warna, logo, font) terlihat di seluruh aplikasi setelah disimpan tanpa muat ulang. Warna dengan kontras di bawah standar ditolak.
19. Realtime memperbarui halaman Pesanan dan Verifikasi tanpa muat ulang (diuji E2E).
20. Staff dibuat lewat endpoint dengan pengecekan super admin, dan tercatat di audit.
21. Perubahan peran dan status staff dilindungi dari self-change dan super admin terakhir.
22. Setiap halaman utama lolos axe pada tema terang dan gelap tanpa pelanggaran serius atau kritis.
23. Setiap target sentuh minimal 44×44 px (diuji dengan pemeriksaan otomatis pada komponen utama).
24. POS dapat digunakan penuh dengan keyboard dan pada viewport 768 px.
25. Lighthouse performa minimal 85 untuk POS dan Pesanan pada build production dengan login.
26. Bundle production tidak mengandung secret. Pemeriksaan CI lulus.
27. `pnpm audit --audit-level=high` dan gitleaks lulus.
28. `vercel.json` memuat header keamanan sesuai 6.2. Verifikasi dengan `curl -I` terhadap deployment staging.
29. `.env.example` lengkap dan tidak berisi nilai rahasia.
30. Dokumentasi kode berupa komentar pada RPC dan tipe publik tersedia. Tidak ada dokumen tambahan selain README pendek.
31. Tidak ada `console.log`, `any` tanpa justifikasi, `@ts-ignore` baru, atau mock data di kode produksi.
32. Semua teks UI berada di `shared/strings/id.ts` dan berbahasa Indonesia.
33. Audit log mencatat semua tindakan di bagian 10.12.
34. Backup dan prosedur pemulihan terdokumentasi dan pernah diuji.

---

## 21. Hal yang Wajib Dilakukan Pemilik (Di Luar AI)

1. Membuat proyek Supabase staging dan production, serta mengatur variabel lingkungan di Vercel dan GitHub Secrets.
2. Mengonfigurasi rate limit login di Supabase Auth.
3. Membuat akun super admin pertama lewat Supabase Auth, lalu mengubah perannya ke `super_admin` lewat SQL yang dijalankan sekali oleh pemilik. Ini satu-satunya perubahan manual pada data.
4. Menghubungkan domain dan memastikan `site_url` sesuai.
5. Menjalankan `supabase db push` ke production setelah review migrasi.
6. Mengonfigurasi alert di Sentry.
7. Menguji struk pada printer fisik di perangkat kasir sebelum go-live.
8. Melakukan uji pemulihan backup sekali sebelum go-live.

---

## 22. Daftar Larangan Ringkas untuk AI

- Menulis tabel langsung dari klien.
- Menghitung total uang di luar fungsi `money.ts` atau RPC.
- Menambah RPC, tabel, kolom, atau paket di luar spesifikasi.
- Menyimpan token, PIN, atau data transaksi di localStorage.
- Memakai CDN eksternal untuk font, script, atau stylesheet.
- Memakai `dangerouslySetInnerHTML`.
- Membuat test yang melewatkan kasus di bagian 17.2 atau 17.3.
- Menurunkan ambang coverage, skor Lighthouse, atau kriteria axe.
- Menganggap pemeriksaan peran di UI sebagai pengganti RLS.
- Mengubah migrasi lama.
- Membuat fitur di luar ruang lingkup bagian 2.
