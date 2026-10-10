# JOKGER

Sistem Point of Sale (POS) untuk restoran/kafe modern, dibangun dengan React 18, TypeScript, Vite, dan Supabase.

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Stak Teknologi](#stak-teknologi)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi Lingkungan](#konfigurasi-lingkungan)
- [Menjalankan Development](#menjalankan-development)
- [Database](#database)
- [Testing](#testing)
- [Build Production](#build-production)
- [Deployment](#deployment)
- [Struktur Proyek](#struktur-proyek)
- [Perintah Berguna](#perintah-berguna)

## Fitur Utama

**Operasional Kasir**

- POS dengan dukungan dine-in & takeaway
- Open bill (pesanan bayar di akhir)
- Pembayaran tunai, transfer, e-wallet, dan split payment
- Cetak struk Bluetooth ESC/POS + fallback browser print

**Manajemen Pesanan**

- Status: baru, diproses, siap, selesai, dibatalkan
- Void item dengan pengembalian stok otomatis
- Pembatalan pesanan dengan refund otomatis
- Retur pesanan selesai (super admin)

**Inventaris & Stok**

- Bahan baku, resep menu, pergerakan stok
- Pembelian, waste, stok opname
- Notifikasi stok menipis

**Promosi & Pembayaran**

- Voucher persen/nominal dengan kuota & syarat minimum
- Rekening pembayaran (transfer/e-wallet) dengan verifikasi bukti
- Verifikasi pembayaran oleh staff

**Laporan & Analitik**

- Laporan penjualan harian/bulanan (RPC `get_sales_report`)
- Ekspor CSV riwayat transaksi
- Audit log lengkap

**Manajemen & Pengaturan**

- Multi-role: super admin & admin (kasir)
- Manajemen staff, pengaturan toko, branding (warna, font, logo)
- Shift kasir dengan perhitungan kas otomatis
- Pengaturan printer thermal per perangkat

**Teknis**

- Realtime pada halaman Pesanan & Verifikasi Pembayaran
- Offline detection dengan banner
- Idempotency key untuk transaksi uang
- Type-safe end-to-end (Zod + TypeScript + pgTAP)

## Stak Teknologi

| Lapisan                | Teknologi                                                   |
| ---------------------- | ----------------------------------------------------------- |
| **Runtime**            | Node.js 24 LTS                                              |
| **Package Manager**    | pnpm 9                                                      |
| **Language**           | TypeScript 5.5+ (strict mode)                               |
| **Frontend**           | React 18.3, Vite 6.4.3+, React Router 6.28+                 |
| **State Management**   | TanStack Query 5 (server), Zustand 5 (lokal)                |
| **Forms & Validation** | React Hook Form 7, Zod 3.23+                                |
| **Styling**            | Tailwind CSS 3.4, shadcn/ui (Radix UI)                      |
| **Backend**            | Supabase (PostgreSQL 15+, Auth, Storage, Realtime)          |
| **Serverless**         | Vercel Functions (Node.js 24)                               |
| **Hosting**            | Vercel                                                      |
| **Error Tracking**     | Sentry                                                      |
| **Testing**            | Vitest 4.0.18+, Playwright, pgTAP                           |
| **Lint/Format**        | ESLint 9 (flat), Prettier 3, Husky, lint-staged, commitlint |

## Prasyarat

- Node.js 24 (gunakan `.nvmrc`)
- pnpm 9.15.9 (`corepack enable`)
- Supabase CLI (`brew install supabase/tap/supabase` atau `npm i -g supabase`)
- Git

## Instalasi

```bash
# Clone repository
git clone <repository-url>
cd JOKGER

# Install dependencies
corepack enable
pnpm install --frozen-lockfile

# Setup Husky git hooks
pnpm prepare
```

## Konfigurasi Lingkungan

Salin file contoh dan isi nilai-nilainya:

```bash
cp .env.example .env
```

**Variabel Klien (VITE\_*)** - masuk ke bundle:

- `VITE_SUPABASE_URL` - URL proyek Supabase
- `VITE_SUPABASE_ANON_KEY` - Anon key Supabase
- `VITE_SENTRY_DSN` - (Opsional) DSN Sentry untuk error tracking
- `VITE_APP_ENV` - `local` | `staging` | `production`

**Variabel Server (Vercel Functions)** - **jangan** masuk bundle:

- `SUPABASE_URL` - Sama dengan klien
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (hanya server!)
- `SENTRY_DSN` - (Opsional) DSN Sentry untuk server

## Menjalankan Development

```bash
# Terminal 1: Start Supabase local
pnpm db:start

# Terminal 2: Jalankan dev server web
pnpm dev
```

Aplikasi akan tersedia di `http://localhost:5173` (atau port yang ditampilkan Vite).

**Akun demo lokal** (dibuat ulang oleh `pnpm db:reset`):

| Peran       | Email                | Kata sandi        |
| ----------- | -------------------- | ----------------- |
| Admin       | `admin@jokger.local` | `AdminLocal#2026` |
| Super admin | `owner@jokger.local` | `OwnerLocal#2026` |

Kredensial ini hanya untuk database lokal yang dapat dibuang. Jangan gunakan atau seed akun ini ke staging maupun production. CI memakai `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SUPER_EMAIL`, dan `E2E_SUPER_PASSWORD` dari secret environment masing-masing.

### Membuat akun production pertama

Jangan jalankan atau salin akun demo dari `supabase/seed.sql` ke production. Buat user pemilik pertama melalui Supabase Dashboard → Authentication → Users, gunakan email pemilik dan kata sandi sementara yang unik, lalu jalankan SQL satu kali berikut di SQL Editor dengan email dan nama pemilik yang sebenarnya:

```sql
do $$
declare
   owner_user auth.users%rowtype;
begin
   select * into owner_user
   from auth.users
   where email = lower('EMAIL_PEMILIK_DI_SINI')
   for update;

   if not found then
      raise exception 'User Auth pemilik tidak ditemukan';
   end if;

   insert into public.profiles (id, email, full_name, role, is_active)
   values (owner_user.id, owner_user.email, 'Nama Pemilik', 'super_admin', true)
   on conflict (id) do update
   set email = excluded.email,
         full_name = excluded.full_name,
         role = 'super_admin',
         is_active = true,
         updated_at = now();
end;
$$;
```

Masuk memakai akun tersebut, lalu buka `/account/password` untuk mengganti kata sandi sementara. Jangan mencatat kata sandi production di SQL, README, seed, atau Git; simpan hanya pada password manager pemilik.

## Database

### Migrasi

```bash
# Reset database lokal (hapus data, jalankan ulang migrasi + seed)
pnpm db:reset

# Push perubahan skema ke local (development cepat)
pnpm db:push

# Generate TypeScript types dari schema lokal
pnpm db:types
```

### Migrasi Baru

```bash
# Buat file migrasi baru (beri nama deskriptif)
supabase migration new nama_migrasi

# Edit file di supabase/migrations/<timestamp>_nama_migrasi.sql
# Lalu reset untuk test
pnpm db:reset
```

**Aturan:** Migrasi yang sudah di-commit **tidak boleh diubah**. Buat migrasi baru untuk perubahan.

### Testing Database (pgTAP)

```bash
# Jalankan test database
pnpm db:test
```

Setiap RPC baru **wajib** disertai test pgTAP di `supabase/tests/`.

## Testing

```bash
# Semua test
pnpm test

# Unit & component test (Vitest)
pnpm test:unit

# E2E test (Playwright)
pnpm test:e2e

# Hanya lint
pnpm lint

# Typecheck (web + api)
pnpm typecheck

# Format check
pnpm format:check

# Auto-fix format & lint
pnpm format
```

**Standar Test:**

- Setiap halaman wajib lolos **axe** accessibility test
- Setiap RPC baru wajib punya test pgTAP
- Coverage unit test untuk `logic.ts` (fungsi murni)

## Build Production

```bash
# Build web app
pnpm build
```

Output ada di `apps/web/dist/`. Build menjalankan `tsc -b` lalu `vite build`.

## Deployment

### Vercel (Recommended)

1. Connect repository ke Vercel
2. Set environment variables di Vercel Dashboard:
   - Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_APP_ENV=production`
   - Server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN`
3. Deploy otomatis dari branch `main`

`vercel.json` sudah mengatur:

- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm --filter @jokger/web build`
- Output: `apps/web/dist`
- Serverless functions: `api/**/*.ts` (Node.js 24)
- SPA rewrite ke `index.html`
- Security headers (CSP, HSTS, dll.)

### Supabase Production

1. Buat project Supabase production
2. Jalankan migrasi: `supabase db push --project-ref <ref>`
3. Atur Auth:
   - `enable_signup = false`
   - Email confirmation: OFF
   - Password min 10 karakter
   - Rate limit login
4. Storage buckets:
   - `payment-proofs` (private, 5MB, image/jpeg|png|webp)
   - `public-assets` (public, 1MB, image/png|svg+xml|webp)
5. Realtime publication: `supabase_realtime` berisi `orders` dan `payments`

## Struktur Proyek

```
jokger/
├─ apps/web/                 # Frontend React SPA
│  ├─ src/
│  │  ├─ app/               # Provider, router, guards, layouts
│  │  ├─ features/          # Fitur-fitur (auth, pos, orders, dll.)
│  │  │  └─ <feature>/
│  │  │     ├─ api.ts       # Pemanggil Supabase RPC
│  │  │     ├─ hooks.ts     # TanStack Query hooks
│  │  │     ├─ logic.ts     # Fungsi murni (unit-testable)
│  │  │     ├─ schemas.ts   # Zod schemas
│  │  │     ├─ types.ts     # Type feature-specific
│  │  │     └─ index.ts     # Public exports
│  │  ├─ shared/
│  │  │  ├─ ui/             # Primitive components (shadcn)
│  │  │  ├─ components/     # App components (Money, DataTable, dll.)
│  │  │  ├─ lib/            # Utilities (money, datetime, errors, dll.)
│  │  │  ├─ stores/         # Zustand stores (cart, device, theme)
│  │  │  ├─ hooks/          # Shared hooks
│  │  │  ├─ strings/id.ts   # SEMUA teks UI bahasa Indonesia
│  │  │  └─ types/database.ts  # Generated types (jangan edit manual)
│  │  └─ styles/index.css   # Global styles + CSS variables
│  ├─ e2e/                  # Playwright tests
│  ├─ tests/                # Vitest setup & utilities
│  └─ vite.config.ts
├─ api/                      # Vercel Functions
│  └─ admin/create-staff.ts  # Endpoint buat staff (service role)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/           # Berurutan, timestamped, immutable
│  ├─ seed.sql              # Data seed (local & staging only)
│  └─ tests/                # pgTAP tests
├─ docs/
│  ├─ Spesifikasi Teknis Baseline Final JOKGER.md
│  └─ Spesifikasi Frontend Baseline Final JOKGER.md
├─ .github/workflows/ci.yml
├─ vercel.json
├─ .env.example
├─ .nvmrc
├─ pnpm-workspace.yaml
└─ package.json
```

## Perintah Berguna

```bash
# Development
pnpm dev                    # Start web dev server
pnpm db:start              # Start Supabase local
pnpm db:reset              # Reset DB local (migrasi + seed)
pnpm db:push               # Push schema changes to local
pnpm db:types              # Generate TS types from DB

# Code Quality
pnpm lint                  # ESLint
pnpm format                # Prettier write
pnpm format:check          # Prettier check
pnpm typecheck             # TypeScript check (web + api)

# Testing
pnpm test                  # All tests
pnpm test:unit             # Vitest
pnpm test:e2e              # Playwright
pnpm db:test               # pgTAP database tests

# Build & Deploy
pnpm build                 # Production build

# Database (Supabase CLI)
supabase migration new <name>   # Buat migrasi baru
supabase db diff                # Lihat diff schema
supabase status                 # Status local Supabase
```

## Aturan Penting

1. **Uang = Integer Rupiah** - Tidak pernah pakai `float`
2. **Semua penulisan data lewat RPC** - Klien tidak `insert/update/delete` langsung ke tabel
3. **Service role key HANYA di server** - Jangan pernah di `VITE_*` atau bundle klien
4. **Semua teks UI di `shared/strings/id.ts`** - Tidak ada string hardcoded di komponen
5. **Migrasi immutable** - Yang sudah commit tidak boleh diubah
6. **Test wajib** - RPC baru = pgTAP test, Halaman baru = axe test
7. **No `any`/`@ts-ignore` tanpa justifikasi teknis**

## Lisensi

Proprietary - Internal use only.
