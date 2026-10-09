# JOKGER

Aplikasi operasional kasir berbasis React, Supabase, dan Vercel.

## Menjalankan lokal

Gunakan Node.js 20 dan pnpm 9.15.9. Salin `.env.example` menjadi `.env`, isi URL dan anon key Supabase lokal, lalu jalankan:

```sh
pnpm install --frozen-lockfile
pnpm db:start
pnpm db:reset
pnpm dev
```

Supabase Auth, domain `site_url`, rate limit login, proyek staging/production, secret Vercel, Sentry, dan printer fisik harus dikonfigurasi pemilik sebelum deployment. `SUPABASE_SERVICE_ROLE_KEY` hanya boleh disetel sebagai secret fungsi server Vercel.
