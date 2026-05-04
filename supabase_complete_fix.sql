-- ============================================================
-- Physio Allmend – Vollständiger Fix
-- Im Supabase SQL Editor ausführen
-- ============================================================

-- 1) Hilfsfunktion ohne RLS-Rekursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 2) PROFILES – alle alten Policies löschen
DROP POLICY IF EXISTS "profiles_select_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_physio"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin"   ON public.profiles;

-- 3) PROFILES – neue Policies (get_my_role statt subquery)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_physio_admin" ON public.profiles
  FOR SELECT USING (public.get_my_role() IN ('admin', 'physio'));

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.get_my_role() = 'admin');

CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.get_my_role() = 'admin');


-- 4) TREATMENT_TYPES – Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.treatment_types (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name         TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  description  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "treatment_types_select" ON public.treatment_types;
CREATE POLICY "treatment_types_select" ON public.treatment_types
  FOR SELECT USING (auth.role() = 'authenticated');

-- Behandlungsarten einfügen (nur wenn noch nicht vorhanden)
INSERT INTO public.treatment_types (name, duration_min, description) VALUES
  ('Physiotherapie',       60, 'Klassische Physiotherapiebehandlung'),
  ('Pilates Einzelstunde', 55, 'Individuelles Pilates-Training'),
  ('Erstgespräch',         30, 'Erstes Kennenlernen und Befundaufnahme'),
  ('Nachkontrolle',        30, 'Verlaufskontrolle und Anpassung')
ON CONFLICT DO NOTHING;


-- 5) BOOKINGS – Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.bookings (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  treatment_type_id UUID REFERENCES public.treatment_types(id) NOT NULL,
  requested_date    DATE NOT NULL,
  requested_time    TIME NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes             TEXT,
  google_event_id   TEXT,
  confirmed_by      UUID REFERENCES public.profiles(id),
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 6) BOOKINGS – Policies (ebenfalls ohne Rekursion)
DROP POLICY IF EXISTS "bookings_select_own"           ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_physio_admin"  ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_patient"       ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_physio_admin"  ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_own_cancel"    ON public.bookings;

CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "bookings_select_physio_admin" ON public.bookings
  FOR SELECT USING (public.get_my_role() IN ('admin', 'physio'));

CREATE POLICY "bookings_insert_patient" ON public.bookings
  FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY "bookings_update_physio_admin" ON public.bookings
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'physio'));

CREATE POLICY "bookings_update_own_cancel" ON public.bookings
  FOR UPDATE USING (patient_id = auth.uid() AND status = 'pending');


-- 7) ADMIN-KONTO freischalten
-- (E-Mail anpassen falls nötig)
UPDATE public.profiles
  SET role = 'admin', is_blocked = false
  WHERE email = 'walter.zollinger@tomtalent.ch';
