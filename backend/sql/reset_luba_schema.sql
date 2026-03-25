-- WARNING: destructive script.
-- Drops existing app tables in public schema and recreates
-- the schema to match backend/db/models.py.

BEGIN;


DROP TABLE IF EXISTS public.finances CASCADE;
DROP TABLE IF EXISTS public.migrants CASCADE;
DROP TABLE IF EXISTS public.brigades CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Recreate tables
CREATE TABLE public.users (
  id varchar PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  full_name varchar(255) NOT NULL,
  hashed_password varchar(255) NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  is_accountant boolean NOT NULL DEFAULT false,
  is_migration_officer boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);

CREATE TABLE public.companies (
  id varchar PRIMARY KEY,
  name varchar(255) NOT NULL,
  inn varchar(64) NOT NULL,
  kpp varchar(64),
  legal_address text NOT NULL,
  contact_person varchar(255) NOT NULL,
  contact_phone varchar(64) NOT NULL,
  contact_email varchar(255) NOT NULL,
  tariff_per_day double precision NOT NULL,
  contract_number varchar(128),
  contract_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);

CREATE TABLE public.rooms (
  id varchar PRIMARY KEY,
  room_number varchar(32) NOT NULL,
  floor integer NOT NULL,
  bed_count integer NOT NULL,
  occupied_beds integer NOT NULL DEFAULT 0,
  status varchar(32) NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL
);

CREATE TABLE public.brigades (
  id varchar PRIMARY KEY,
  company_id varchar NOT NULL,
  room_id varchar,
  name varchar(255) NOT NULL,
  check_in_date timestamptz NOT NULL,
  check_out_date timestamptz,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL,
  CONSTRAINT fk_brigades_company
    FOREIGN KEY (company_id) REFERENCES public.companies(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_brigades_room
    FOREIGN KEY (room_id) REFERENCES public.rooms(id)
    ON DELETE SET NULL
);

CREATE TABLE public.migrants (
  id varchar PRIMARY KEY,
  brigade_id varchar NOT NULL,
  full_name varchar(255) NOT NULL,
  passport_number varchar(128) NOT NULL,
  passport_issued_date timestamptz NOT NULL,
  passport_expiry_date timestamptz NOT NULL,
  migration_card_number varchar(128),
  migration_card_expiry timestamptz,
  work_patent_number varchar(128),
  work_patent_expiry timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  CONSTRAINT fk_migrants_brigade
    FOREIGN KEY (brigade_id) REFERENCES public.brigades(id)
    ON DELETE CASCADE
);

CREATE TABLE public.finances (
  id varchar PRIMARY KEY,
  company_id varchar NOT NULL,
  type varchar(32) NOT NULL,
  amount double precision NOT NULL,
  description text NOT NULL,
  date timestamptz NOT NULL,
  status varchar(32) NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT fk_finances_company
    FOREIGN KEY (company_id) REFERENCES public.companies(id)
    ON DELETE CASCADE
);

-- Helpful indexes
CREATE INDEX idx_companies_name ON public.companies(name);
CREATE INDEX idx_rooms_floor_room ON public.rooms(floor, room_number);
CREATE INDEX idx_brigades_created_at ON public.brigades(created_at DESC);
CREATE INDEX idx_migrants_full_name ON public.migrants(full_name);
CREATE INDEX idx_finances_date ON public.finances(date DESC);

COMMIT;
