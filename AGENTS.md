# Instruksi untuk AI Agent — Project CashFlow

Baca ini SEBELUM menjalankan perintah apa pun yang menyentuh database, environment variable, atau proses deploy.

## 1. Ada DUA environment terpisah — jangan pernah mencampur keduanya

| | Development (lokal) | Production |
|---|---|---|
| Database | Postgres via Docker, di komputer lokal | Neon (`*.neon.tech`) |
| Redis | Redis via Docker, di komputer lokal | Upstash (`*.upstash.io`) |
| Config | `apps/backend/.env.development` | Vercel → Environment Variables |
| Diakses lewat | `localhost:3000` / `localhost:3001` | `cash-flow-phi-indol.vercel.app` dan domain backend Vercel |

**Aturan wajib:** sebelum menjalankan perintah apa pun yang menyebut `DATABASE_URL`, `prisma migrate`, `prisma db push`, atau sejenisnya, agent HARUS menyatakan dengan eksplisit environment mana yang akan disentuh (development atau production), dan menunggu konfirmasi eksplisit dari user sebelum lanjut — kecuali user sudah jelas-jelas minta "jalankan di lokal saja".

**Dilarang tanpa konfirmasi eksplisit:**
- Menjalankan migrasi Prisma langsung ke database Neon (production)
- Mengubah, menghapus, atau menimpa environment variable di Vercel dashboard
- Menjalankan perintah apa pun yang membaca `.env.production` sebagai sumber koneksi nyata (file ini isinya placeholder, BUKAN kredensial asli — kredensial asli hanya ada di Vercel dashboard)

## 2. Sebelum mengubah versi package apa pun (npm install / update)

Setiap kali menginstall atau mengupdate package apa pun, WAJIB mengecek dampaknya ke Prisma sebelum commit:

```
npm ls prisma
npm ls @prisma/client
```

Kalau versi Prisma di root, `apps/backend`, atau lockfile berubah tanpa diminta secara eksplisit oleh user, STOP — laporkan ke user dulu, jangan langsung commit/push. Ini pernah menyebabkan kegagalan deploy berturut-turut karena `npm install` diam-diam menaikkan Prisma dari versi 6 ke versi 7 yang tidak kompatibel dengan schema.

## 3. Sebelum push ke GitHub / trigger deploy Vercel

WAJIB dijalankan dan dipastikan sukses dulu secara lokal sebelum push:

```
cd apps/backend && npm run build
cd apps/frontend && npm run build
```

Jangan push kalau salah satu build gagal di lokal, kecuali user secara eksplisit minta push meski build belum diverifikasi.

## 4. Environment variable baru

Kalau menambahkan environment variable baru ke kode (misal `process.env.NAMA_BARU`), WAJIB memberi tahu user bahwa variable itu perlu ditambahkan secara manual di DUA tempat:
1. `apps/backend/.env.development` (untuk lokal)
2. Vercel Dashboard → Environment Variables (untuk production)

Agent tidak boleh mengasumsikan variable tersebut sudah otomatis tersedia di kedua tempat.

## 5. Kalau ragu

Kalau ada instruksi yang ambigu soal environment mana yang dimaksud (lokal atau production), agent harus BERTANYA dulu ke user, bukan menebak atau memilih "yang paling aman menurut agent" secara diam-diam. Salah tebak di sini bisa berakibat ke data production yang nyata dipakai user.

## 6. Setelah deploy ke production

Setelah push yang memicu deploy Vercel, agent harus mengingatkan user untuk mengecek status deployment di Vercel (Ready/Error) sebelum menganggap tugas selesai. Jangan menyatakan "sudah beres" hanya berdasarkan `git push` berhasil.
