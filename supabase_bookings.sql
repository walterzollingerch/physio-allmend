-- ============================================================
-- Physio Allmend – Bookings Schema (v2)
-- Führe dieses Script im Supabase SQL Editor aus
-- ============================================================

-- ============================================================
-- TREATMENT TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.treatment_types (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.treatment_types (name, duration_min, description) VALUES
  ('Physiotherapie', 60, 'Klassische Physiotherapiebehandlung'),
  ('Pilates Einzelstunde', 55, 'Individuelles Pilates-Training'),
  ('Erstgespräch', 30, 'Erstes Kennenlernen und Befundaufnahme'),
  ('Nachkontrolle', 30, 'Verlaufskontrolle und Anpassung');

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  treatment_type_id UUID REFERENCES public.treatment_types(id) NOT NULL,
  requested_date   DATE NOT NULL,
  requested_time   TIME NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes            TEXT,
  google_event_id  TEXT,
  confirmed_by     UUID REFERENCES public.profiles(id),
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Treatment types: alle eingeloggten User können lesen
CREATE POLICY "treatment_types_select" ON public.treatment_types
  FOR SELECT USING (auth.role() = 'authenticated');

-- Bookings: Patient sieht eigene
CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (patient_id = auth.uid());

-- Bookings: Physio & Admin sehen alle
CREATE POLICY "bookings_select_physio_admin" ON public.bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'physio'))
  );

-- Bookings: Patient kann eigene erstellen
CREATE POLICY "bookings_insert_patient" ON public.bookings
  FOR INSERT WITH CHECK (patient_id = auth.uid());

-- Bookings: Physio & Admin können updaten (bestätigen/absagen)
CREATE POLICY "bookings_update_physio_admin" ON public.bookings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'physio'))
  );

-- Bookings: Patient kann eigene absagen (nur wenn pending)
CREATE POLICY "bookings_update_own_cancel" ON public.bookings
  FOR UPDATE USING (
    patient_id = auth.uid() AND status = 'pending'
  );
