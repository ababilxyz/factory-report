# Supabase Database Setup Guide

## Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New project"
3. Fill in project name (e.g., "factory-report"), password, select a region
4. Wait for project to be created

## Step 2: Get API Credentials
1. Go to Project Settings > API
2. Copy the following values to your `.env` file:
   - `VITE_SUPABASE_URL` = Your project URL (starts with `https://`)
   - `VITE_SUPABASE_ANON_KEY` = anon/public key

## Step 3: Set Up Database Schema

Go to the SQL Editor in Supabase Dashboard and run the following SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  uid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role = 'admin' OR role = 'worker') NOT NULL,
  display_name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Areas table (zona area)
CREATE TABLE areas (
  area_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  allowed_lat NUMERIC NOT NULL,
  allowed_lng NUMERIC NOT NULL,
  radius_meters NUMERIC NOT NULL
);

-- Items table (setiap item punya QR terpisah)
CREATE TABLE items (
  item_id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES areas(area_id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  encrypted_qr_payload TEXT,
  example_photo_url TEXT,
  display_order INTEGER DEFAULT 0
);

-- Item checks (setiap item punya beberapa pertanyaan checklist)
CREATE TABLE item_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  check_label TEXT NOT NULL,
  check_options TEXT[] NOT NULL,
  display_order INTEGER DEFAULT 0
);
```

## Step 4: Configure Storage (Supabase Storage)

1. Go to Storage > Buckets in Supabase Dashboard
2. Create a new bucket named `factory-reports`
3. Set the bucket to **Public** (for image URLs to be accessible)
4. Add bucket policies:

```sql
-- Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert files
CREATE POLICY "Authenticated can upload" ON storage.objects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow everyone to view files (since bucket is public)
CREATE POLICY "Public can view" ON storage.objects
  FOR SELECT USING (bucket_id = 'factory-reports');
```

## Step 5: Configure Authentication

### Enable Email Authentication
1. Go to Authentication > Providers in Supabase Dashboard
2. Enable "Email" provider
3. Disable "Confirm email" if you want instant access (for testing)

### Create Admin User
After setting up auth, create an admin user directly in the database:

```sql
-- First sign up via the app to create the user
-- Then update their role to admin:
UPDATE users SET role = 'admin', display_name = 'Admin User' WHERE email = 'admin@factory.com';
```

Or use the Supabase Dashboard:
1. Go to Authentication > Users
2. Click "Add user" 
3. Enter email and password
4. After creation, go to the SQL Editor and run:
```sql
UPDATE users SET role = 'admin', display_name = 'Admin User' WHERE email = 'admin@factory.com';
```

## Step 6: Add Areas, Items & Checks (Required for QR Scanning)

QR di-generate per item, bukan per area. Setiap item punya QR terpisah.

```sql
-- Areas (zona)
INSERT INTO areas (area_id, name, allowed_lat, allowed_lng, radius_meters)
VALUES ('area-001', 'Production Floor A', -6.2088, 106.8456, 50),
       ('area-002', 'Warehouse B', -6.2090, 106.8450, 50),
       ('area-003', 'Assembly Line', -6.2092, 106.8452, 50),
       ('area-004', 'Storage Room', -6.2094, 106.8454, 50);

-- Items (tiap item punya QR) - encrypted_qr_payload di-generate via aplikasi
-- example_photo_url is optional (URL from Supabase Storage)
INSERT INTO items (item_id, area_id, code, name, example_photo_url, display_order)
VALUES 
  ('item-001', 'area-001', 'D-1.01', 'Meja dan Kursi Oasis', 'https://your-project.supabase.co/storage/v1/object/public/factory-reports/examples/desk-good.jpg', 1),
  ('item-002', 'area-001', 'D-1.02', 'Meja Computer', 'https://your-project.supabase.co/storage/v1/object/public/factory-reports/examples/computer-desk.jpg', 2),
  ('item-003', 'area-001', 'D-1.03', 'Printer Area', NULL, 3),
  ('item-004', 'area-001', 'D-1.04', 'Safety Equipment', 'https://your-project.supabase.co/storage/v1/object/public/factory-reports/examples/safety.jpg', 4);

-- Item Checks (checklist per item) - dengan urutan tampilan
INSERT INTO item_checks (item_id, check_label, check_options, display_order)
VALUES 
  ('item-001', 'identitas', '{"Baik","Rusak"}', 1),
  ('item-001', 'layout', '{"Sesuai","Tidak Sesuai"}', 2),
  ('item-002', 'identitas', '{"Baik","Rusak"}', 1),
  ('item-002', 'layout', '{"Sesuai","Tidak Sesuai"}', 2),
  ('item-003', 'identitas', '{"Baik","Rusak"}', 1),
  ('item-003', 'kondisi', '{"Bersih","Kotor"}', 2),
  ('item-004', 'ketersediaan', '{"Lengkap","Tidak Lengkap"}', 1),
  ('item-004', 'kondisi', '{"Baik","Rusak"}', 2);
-- dst untuk item lainnya
```

QR di-generate via halaman admin QR Generator (bukan manual SQL).

## Step 7: Set Up Row Level Security (Optional but Recommended)

For production, enable RLS to secure data access:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users policies - users can read their own data
CREATE POLICY "Users can view own data" ON users 
  FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "Users can update own data" ON users 
  FOR UPDATE USING (auth.uid() = uid);

-- Areas policies - anyone can read areas
CREATE POLICY "Anyone can view areas" ON areas 
  FOR SELECT USING (true);

-- Items policies - anyone can read items
CREATE POLICY "Anyone can view items" ON items 
  FOR SELECT USING (true);

-- Item checks policies - anyone can read checks
CREATE POLICY "Anyone can view item_checks" ON item_checks 
  FOR SELECT USING (true);

-- Reports policies - workers can create/read own reports, admins can view all
CREATE POLICY "Workers can create reports" ON reports 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Workers can view own reports" ON reports 
  FOR SELECT USING (auth.uid() = worker_uid);
CREATE POLICY "Admins can view all reports" ON reports 
  FOR SELECT USING ( EXISTS (
    SELECT 1 FROM users WHERE uid = auth.uid() AND role = 'admin'
  ));
```

## Step 8: Install Dependencies

```bash
npm install
```

## Step 9: Update Environment Variables

Edit `.env` file with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_QR_SECRET_KEY=your-qr-secret-key-here
```

## Step 10: Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. In Vercel project settings, add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_QR_SECRET_KEY`
4. Deploy!

## Migration Notes

- Firebase uses `camelCase` field names, Supabase uses `snake_case`
- The code handles conversion automatically (see `supabaseDb.ts`)
- User IDs will change from Firebase UID to Supabase UUID
- You may need to migrate existing data manually or via CSV import
- Images now use Supabase Storage instead of Cloudinary
- QR codes are now per-item instead of per-area (reusable)
- Checks support `display_order` for custom ordering