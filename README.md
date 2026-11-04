# FactoryReport

Aplikasi pelaporan inspeksi 4S (Seiri, Seiton, Seiso, Seiketsu) untuk lantai produksi pabrik. Petugas memindai QR pada mesin, mengisi checklist, dan mengirim laporan yang terikat lokasi GPS. Admin memverifikasi, menjadwalkan inspeksi dari Excel, dan mengekspor hasil audit.

Satu basis kode data (Supabase), dua klien:

- **Android** — Kotlin + Jetpack Compose (jalur utama petugas lapangan)
- **PWA** — React + TypeScript + Vite (jalur iPhone dan desktop tanpa Apple Developer Program)

---

## Fitur

**Petugas (worker)**
- Pindai QR mesin — wajib, tidak bisa dilewati (anti-kecurangan)
- Checklist per item dengan opsi hasil pemeriksaan
- Foto bukti hanya diwajibkan saat ada masalah, bukan pada inspeksi normal
- Validasi geofence: laporan ditolak jika di luar radius area atau memakai fake GPS
- Riwayat laporan dengan pemisah tanggal dan filter status

**Admin**
- Dasbor ringkasan: total, menunggu, selesai, masalah aktif
- Filter status / area / "Masalah Aktif"
- Verifikasi dan tutup laporan
- Impor jadwal inspeksi dari `Schedule 4S.xlsx`
- Ekspor laporan audit ke CSV (UTF-8 BOM, aman untuk Excel) dan PDF

---

## Status laporan

Satu sumber kebenaran, dipakai sama di Kotlin dan web (`src/lib/reportStatus.ts`):

| Kondisi | Badge |
| --- | --- |
| `resolved` | `SELESAI` |
| `pending` + ada masalah | `PERLU DIPERBAIKI` |
| `pending` tanpa masalah | `MENUNGGU` |

Masalah hanya dianggap **aktif** selama laporan masih `pending`. Setelah laporan ditutup, kartu berhenti menampilkan badge masalah dan ringkasannya berubah menjadi `Masalah sudah ditangani`. Tanpa aturan ini, laporan yang sudah selesai tetap tampil "MASALAH" selamanya.

---

## Tema

Monokrom gelap. Hierarki dibawa oleh kontras dan bobot huruf, bukan warna. Satu-satunya hue yang tersisa adalah clay untuk bahaya.

| Token | Nilai | Dipakai untuk |
| --- | --- | --- |
| `#18191C` | latar halaman | background |
| `#222429` | permukaan kartu | card |
| `#2F3238` | border | garis |
| `#F4F5F7` | teks utama | text |
| `#A8AEBC` | teks redup | secondary |
| `#8E929B` | teks muted | hint |
| `#C4623F` | bahaya / masalah | error |

Kontras terukur terhadap kartu: teks 13.9:1, redup 7.2:1, border 3.1:1 — lolos WCAG AA.

---

## Struktur

```
factory-report/
├── src/                     # PWA (React + TS)
│   ├── pages/               # Login, WorkerHome, Scanner, ReportForm,
│   │                        # History, Profile, AdminDashboard, QrGenerator
│   ├── components/          # RouteGuards, AdminScheduleManager
│   ├── hooks/               # useAuth, useQrScanner
│   ├── lib/                 # supabase, supabaseDb, storage, reportStatus
│   ├── utils/               # encryption, geolocation, deviceFingerprint,
│   │                        # rateLimiter, sanitizer, imageUtils, scheduleParser
│   └── types/
├── public/                  # ikon PWA (wajib ada, dipakai iOS Add to Home Screen)
├── scripts/                 # generator QR & setup user
├── android/                 # klien Kotlin + Compose
├── index.html
├── vite.config.ts           # PWA manifest + service worker
├── tailwind.config.js       # token warna factory-*
└── Schedule 4S.xlsx         # template jadwal inspeksi
```

---

## Prasyarat

- Node.js 18+
- npm 9+
- Untuk Android: JDK 21, Android SDK 34, emulator atau perangkat fisik

---

## Setup PWA

1. Pasang dependensi

   ```bash
   npm install
   ```

2. Buat `.env` di root proyek

   ```env
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   VITE_QR_SECRET_KEY=<secret-untuk-payload-qr>
   ```

   `.env` sudah masuk `.gitignore`. Jangan pernah commit nilainya.

3. Jalankan mode pengembangan

   ```bash
   npm run dev
   ```

   Buka `http://localhost:5173`. Root akan mengarahkan ke `/login`. Halaman `/home` sampai `/history` untuk worker, `/dashboard` dan `/qr-generator` untuk admin.

4. Build produksi

   ```bash
   npm run build
   ```

   Hasil ada di `dist/`, termasuk `manifest.webmanifest`, `sw.js`, dan ikon PWA.

5. Pratinjau hasil build

   ```bash
   npm run preview
   ```

---

## Build Android

Wrapper Gradle tidak ikut ter-versi (direktori `android/` di-ignore). Pakai Gradle yang sudah ter-cache atau pasang lewat SDK manager.

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=$HOME/Android/Sdk

gradle -p android --offline :app:assembleDebug
```

APK di `android/app/build/outputs/apk/debug/app-debug.apk`. Pasang ke emulator:

```bash
adb -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Jalankan unit test:

```bash
gradle -p android --offline :app:testDebugUnitTest
```

Konfigurasi: `compileSdk 34`, `minSdk 24`, `targetSdk 34`, `applicationId com.factoryreport.app`.

---

## PWA di iPhone

Tanpa Apple Developer Program, distribusi iOS memakai PWA:

1. Buka URL aplikasi di **Safari** (bukan Chrome iOS — hanya Safari yang bisa memasang PWA)
2. Ketuk **Bagikan** → **Tambah ke Layar Utama**
3. Aplikasi berjalan `standalone` tanpa address bar, mengikuti `orientation: portrait`

Yang berfungsi di iOS: kamera untuk QR, GPS, geofence, mode offline lewat service worker.
Yang tidak ada: push notification real-time, Bluetooth/NFC, background sync.

Ikon layar utama diambil dari `public/apple-touch-icon.png` (180×180) lewat `<link rel="apple-touch-icon">` di `index.html` — bukan dari manifest. Kalau file itu hilang, ikon jadi kotak abu-abu.

---

## Skema database

Tabel Supabase: `areas`, `items`, `item_checks`, `reports`, `users`, plus pasangan `weekly_items` / `weekly_item_checks` dan `monthly_items` / `monthly_item_checks` untuk checklist periodik.

Dua grup tabel checklist itu memakai struktur identik dengan versi harian, dipisah supaya jadwal mingguan dan bulanan tidak saling menimpa.

---

## Keamanan

- **QR wajib dipindai.** Tidak ada jalur self-authorized untuk melewatinya; ini keputusan produk, bukan keterbatasan teknis.
- **Geofence.** Koordinat di luar radius area ditolak. Lokasi dari provider tiruan (fake GPS) juga ditolak.
- **Payload QR deterministik.** Nonce diturunkan dari `item_id`, jadi label yang sudah dicetak bisa dipindai ulang dari mana saja. Karena itu pembuktian lokasi sepenuhnya bergantung pada GPS, bukan pada keunikan QR.
- **Rate limit + device fingerprint** untuk menahan pengiriman berulang.
- **Enkripsi** payload QR dan data sensitif memakai `crypto-js`.

---

## Lisensi

Proprietary. Tidak untuk didistribusikan ulang.