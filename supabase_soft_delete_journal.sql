-- ============================================================
-- Soft-Delete für journal_entries
-- Führe dieses Script im Supabase SQL Editor aus
-- ============================================================

-- 1. Spalte hinzufügen
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- 2. Index für performante Filterung
CREATE INDEX IF NOT EXISTS idx_journal_entries_not_deleted
  ON public.journal_entries (is_deleted)
  WHERE is_deleted = false;

-- 3. Bestehende Einträge explizit auf false setzen (Sicherheit)
UPDATE public.journal_entries SET is_deleted = false WHERE is_deleted IS NULL;
