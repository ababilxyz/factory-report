create table public.areas (
  area_id uuid not null default gen_random_uuid (),
  name text not null,
  allowed_lat numeric not null,
  allowed_lng numeric not null,
  radius_meters numeric not null,
  display_order integer null default 1,
  constraint areas_pkey primary key (area_id)
) TABLESPACE pg_default;

create table public.item_checks (
  id uuid not null default extensions.uuid_generate_v4 (),
  item_id uuid not null,
  check_label text not null,
  check_options text[] not null,
  display_order bigint null,
  constraint item_checks_pkey primary key (id),
  constraint item_checks_item_id_fkey foreign KEY (item_id) references items (item_id) on delete CASCADE
) TABLESPACE pg_default;

create table public.items (
  item_id uuid not null default gen_random_uuid (),
  area_id uuid not null,
  code text null,
  name text not null,
  encrypted_qr_payload text null,
  display_order integer null default 0,
  example_photo_url text null,
  constraint items_pkey primary key (item_id),
  constraint items_area_id_fkey foreign KEY (area_id) references areas (area_id) on delete CASCADE
) TABLESPACE pg_default;

create table public.reports (
  report_id uuid not null default extensions.uuid_generate_v4 (),
  area_id uuid not null,
  area_name text null,
  worker_uid uuid not null,
  worker_name text null,
  before_photo_url text null,
  after_photo_url text null,
  description text null,
  status text not null,
  gps_lat numeric null,
  gps_lng numeric null,
  timestamp bigint not null,
  device_id text null,
  session_id text null,
  checklist_data jsonb null,
  updated_at bigint null,
  constraint reports_pkey primary key (report_id),
  constraint reports_area_id_fkey foreign KEY (area_id) references areas (area_id),
  constraint reports_worker_uid_fkey foreign KEY (worker_uid) references users (uid) on delete CASCADE,
  constraint reports_status_check check (
    (
      (status = 'pending'::text)
      or (status = 'in_progress'::text)
      or (status = 'resolved'::text)
    )
  )
) TABLESPACE pg_default;

create table public.users (
  uid uuid not null default gen_random_uuid (),
  email text not null,
  role text not null,
  display_name text not null,
  created_at bigint not null,
  updated_at bigint null,
  constraint users_pkey primary key (uid),
  constraint users_email_key unique (email),
  constraint users_role_check check (
    (
      (role = 'admin'::text)
      or (role = 'worker'::text)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_users_email on public.users using btree (email) TABLESPACE pg_default;

create table public.weekly_item_checks (
  id uuid not null default extensions.uuid_generate_v4 (),
  item_id text not null,
  check_label text not null,
  check_options text[] not null,
  display_order integer null default 0,
  constraint weekly_item_checks_pkey primary key (id),
  constraint weekly_item_checks_item_id_fkey foreign KEY (item_id) references weekly_items (item_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_weekly_item_checks_item on public.weekly_item_checks using btree (item_id) TABLESPACE pg_default;

create table public.weekly_items (
  item_id text not null,
  area_id uuid not null,
  code text null,
  name text not null,
  encrypted_qr_payload text null,
  example_photo_url text null,
  display_order integer null default 0,
  constraint weekly_items_pkey primary key (item_id),
  constraint weekly_items_area_id_fkey foreign KEY (area_id) references areas (area_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_weekly_items_area on public.weekly_items using btree (area_id) TABLESPACE pg_default;