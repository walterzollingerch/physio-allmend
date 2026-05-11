-- ============================================================
-- RLS FIX – Infinite Recursion beheben
-- Führe dieses Script im Supabase SQL Editor aus
-- ============================================================

-- Hilfsfunktion: liest die Rolle OHNE RLS (SECURITY DEFINER umgeht Policies)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Bestehende Policies löschen
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_physio" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- Neue Policies (ohne Self-Referenz)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'admin');

CREATE POLICY "profiles_select_physio" ON public.profiles
  FOR SELECT USING (public.get_my_role() IN ('admin', 'physio'));

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.get_my_role() = 'admin');

CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.get_my_role() = 'admin');

-- ============================================================
-- RLS FIX 2 – fehlende UPDATE-Policy auf journal_entries
-- journal_select / journal_insert / journal_delete existieren,
-- aber kein journal_update → alle Updates wurden still blockiert.
-- ============================================================
DROP POLICY IF EXISTS "journal_update" ON public.journal_entries;

CREATE POLICY "journal_update" ON public.journal_entries
  FOR UPDATE
  USING     (public.get_my_role() IN ('admin', 'physio'))
  WITH CHECK (public.get_my_role() IN ('admin', 'physio'));
