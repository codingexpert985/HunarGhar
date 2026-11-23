-- =====================================================================
-- HunarGhar database schema (PostgreSQL 13+)
-- Implements the Data Dictionary of the SRS (Appendix A) plus a few
-- supporting tables (categories, revoked_tokens).
-- =====================================================================

-- ---------- ENUM types ----------
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('customer','provider','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('unverified','pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_status AS ENUM ('pending','accepted','rejected','cancelled','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE mock_payment_status AS ENUM ('not_paid','mock_paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE request_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('open','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Tables ----------
CREATE TABLE IF NOT EXISTS users (
  user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(100) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           user_role    NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  category_id SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS provider_profiles (
  provider_id         UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  bio                 TEXT,
  skills              TEXT,
  city                VARCHAR(100),
  area                VARCHAR(100),
  latitude            NUMERIC(9,6),   -- approximate (city centre) only, never an exact address
  longitude           NUMERIC(9,6),
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  avg_rating          NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count        INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  service_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE CASCADE,
  category     VARCHAR(50) NOT NULL REFERENCES categories(name) ON UPDATE CASCADE,
  description  TEXT NOT NULL,
  price        NUMERIC(10,2) NOT NULL CONSTRAINT services_price_range CHECK (price BETWEEN 700 AND 9000),
  availability VARCHAR(255),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_images (
  image_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE CASCADE,
  image_url   VARCHAR(500) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID NOT NULL REFERENCES users(user_id),
  provider_id        UUID NOT NULL REFERENCES provider_profiles(provider_id),
  service_id         UUID NOT NULL REFERENCES services(service_id),
  requested_datetime TIMESTAMPTZ NOT NULL,
  notes              TEXT,
  status             booking_status NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES users(user_id),
  content    TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_hidden  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS payments (          -- SIMULATED payments only
  payment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  mock_status mock_payment_status NOT NULL DEFAULT 'not_paid',
  paid_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE, -- one review per booking
  customer_id UUID NOT NULL REFERENCES users(user_id),
  provider_id UUID NOT NULL REFERENCES provider_profiles(provider_id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  is_hidden   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_requests (
  request_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE CASCADE,
  status       request_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by  UUID REFERENCES users(user_id),
  reviewed_at  TIMESTAMPTZ,
  admin_note   TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  report_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(user_id),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('profile','review','message')),
  target_id   UUID NOT NULL,
  reason      TEXT NOT NULL,
  status      report_status NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by UUID REFERENCES users(user_id),
  resolved_at TIMESTAMPTZ,
  admin_note  TEXT
);

-- Used by POST /api/auth/logout so that a signed-out token can no longer be used (SFR-05)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        VARCHAR(64) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_services_provider   ON services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_category   ON services(LOWER(category));
CREATE INDEX IF NOT EXISTS idx_profiles_city       ON provider_profiles(LOWER(city));
CREATE INDEX IF NOT EXISTS idx_bookings_customer   ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider   ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_messages_booking    ON messages(booking_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_reviews_provider    ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reports_status      ON reports(status);
CREATE INDEX IF NOT EXISTS idx_verif_status        ON verification_requests(status);
