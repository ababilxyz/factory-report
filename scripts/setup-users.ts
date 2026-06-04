/**
 * Initial User Setup Script for Supabase
 *
 * Run this to create your first admin user in Supabase.
 *
 * To create users in Supabase:
 *
 * 1. Via Supabase Dashboard:
 *    - Go to Authentication > Users
 *    - Click "Add user"
 *    - Enter email and password
 *    - After creation, copy the UUID
 *
 * 2. Add user profile to database via SQL Editor:
 *    - Go to SQL Editor
 *    - Run the following for an admin user:
 *
 * INSERT INTO users (uid, email, role, display_name, created_at)
 * VALUES ('{UUID_FROM_AUTH}', 'admin@yourfactory.com', 'admin', 'Team Leader Name', EXTRACT(EPOCH FROM NOW()) * 1000::BIGINT);
 *
 * For a worker user:
 * INSERT INTO users (uid, email, role, display_name, created_at)
 * VALUES ('{UUID_FROM_AUTH}', 'worker1@yourfactory.com', 'worker', 'Worker Name', EXTRACT(EPOCH FROM NOW()) * 1000::BIGINT);
 *
 * IMPORTANT: Workers cannot self-register. The admin must create accounts
 * via Supabase Dashboard > Authentication and then add the profile record.
 */