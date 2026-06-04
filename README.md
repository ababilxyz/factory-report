# FactoryReport PWA

A secure Progressive Web App for factory issue reporting with encrypted QR codes, GPS verification, and anti-fraud mechanisms.

---

## 📁 Project Structure

```
factory-report/
├── src/
│   ├── components/
│   │   └── RouteGuards.tsx          # Role-based route protection
│   ├── hooks/
│   │   ├── useAuth.tsx              # Firebase auth context
│   │   └── useQrScanner.ts          # QR scanning + verification logic
│   ├── lib/
│   │   ├── firebase.ts              # Firebase initialization
│   │   ├── cloudinary.ts            # Image upload
│   │   └── firestore.ts             # Data access layer
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── WorkerHomePage.tsx
│   │   ├── ScannerPage.tsx          # Camera + QR decode + GPS check
│   │   ├── ReportFormPage.tsx       # Photo capture + submission
│   │   ├── AdminDashboard.tsx       # Reports management
│   │   └── QrGeneratorPage.tsx      # Generate encrypted QR codes
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces
│   └── utils/
│       ├── encryption.ts            # AES-256 QR encrypt/decrypt
│       ├── geolocation.ts           # GPS + Haversine distance
│       ├── imageUtils.ts            # Compression + camera capture
│       └── deviceFingerprint.ts     # Device ID generation
├── scripts/
│   └── generate-qr.mjs             # CLI tool to generate area QR payloads
├── firestore.rules                  # Firestore security rules
├── .env.example                     # Required environment variables
└── vite.config.ts                   # Vite + PWA configuration
```

---

## 🚀 Setup Guide

### 1. Clone and Install

```bash
git clone <repo>
cd factory-report
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see sections below).

---

### 3. Firebase Setup (Free Spark Tier)

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project
2. **Authentication:** Enable Email/Password provider
3. **Firestore:** Create database (production mode)
4. **Get config:** Project Settings → Your apps → Add web app
5. Copy values to `.env`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

6. **Deploy Firestore Rules:**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore
   firebase deploy --only firestore:rules
   ```

7. **Create initial users:**
   - Firebase Console → Authentication → Add user
   - Note the UID
   - Firestore → Create `users` collection → Add document:
     ```json
     {
       "uid": "USER_UID",
       "email": "admin@factory.com",
       "role": "admin",
       "displayName": "Team Leader",
       "createdAt": 1700000000000
     }
     ```

8. **Create areas in Firestore:**
   - Collection: `areas`, Document ID = areaId
   ```json
   {
     "areaId": "line-a-01",
     "name": "Assembly Line A",
     "allowedLat": -6.123456,
     "allowedLng": 106.789012,
     "radiusMeters": 20
   }
   ```

---

### 4. Cloudinary Setup (Free Tier)

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Dashboard → Settings → Upload → **Add upload preset**
   - Signing Mode: **Unsigned**
   - Preset name: `factory_report_unsigned`
   - Folder: `factory-reports`
   - Max file size: 5 MB
   - Allowed formats: `jpg, jpeg, png`
3. Copy to `.env`:
   ```
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=factory_report_unsigned
   ```

---

### 5. QR Secret Key

Generate a strong random key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```
VITE_QR_SECRET_KEY=your_64_char_hex_string_here
```

---

### 6. Run Locally

```bash
npm run dev
```

Open http://localhost:5173 in Chrome on Android for the best PWA experience.

---

### 7. Build for Production

```bash
npm run build
npm run preview  # Test the PWA locally
```

Deploy the `dist/` folder to:
- **Firebase Hosting** (recommended for integration): `firebase deploy --only hosting`
- **Vercel:** `vercel --prod`
- **Netlify:** Drag & drop `dist/` folder

---

## 🔐 Security Architecture

### Anti-Fraud Mechanisms

| Mechanism | How it works |
|-----------|-------------|
| **Encrypted QR** | AES-256 payload with `areaId + timestamp + nonce`. Plain text IDs are never exposed. |
| **Timestamp validation** | QR payloads expire after **5 minutes**. Prevents replay attacks. |
| **GPS verification** | Device GPS must be within `radiusMeters` of the area's coordinates (default: 20m). |
| **One-time use** | Each QR scan generates a unique `sessionId`. Once submitted, that session is locked in Firestore. |
| **Device fingerprint** | SHA-256 hash of browser/device signals. Logged with each report for forensics. |
| **Role-based access** | Firestore rules enforce workers can only create reports; admins can read/update. |
| **Server-side validation** | All GPS data comes from the device, but combined with session locking makes false submissions traceable. |

### Known Limitations (PWA)

- The `VITE_QR_SECRET_KEY` is embedded in the compiled JS bundle. Obfuscation helps but determined attackers can extract it. For highest security, move QR generation and validation to a backend function.
- GPS can be spoofed on rooted Android devices.
- These are acceptable trade-offs for a factory intranet context with known employees.

---

## 📱 Installing as PWA (Android)

1. Open the app URL in Chrome
2. Chrome will show "Add to Home Screen" banner, or:
   - Menu → "Add to Home screen"
3. The app installs and works offline (cached shell)

---

## 🖨️ Generating and Printing QR Codes

1. Log in as admin
2. Navigate to **QR Codes** from the dashboard
3. Select an area → Generate QR
4. Print with browser print dialog
5. Laminate and post in the area

> ⚠️ QR codes shown in the app expire after 5 minutes. Workers scan them in real-time — the app generates fresh codes on demand.

---

## Firestore Indexes Required

Add these composite indexes in Firebase Console → Firestore → Indexes:

```
Collection: reports
Fields: status (Ascending), timestamp (Descending)
```

---

## Environment Variables Summary

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firestore project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned preset name |
| `VITE_QR_SECRET_KEY` | AES encryption key (min 32 chars) |
