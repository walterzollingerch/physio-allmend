-- Geschäftsjahr-Zuweisung zu Buchungen
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS fiscal_year_id uuid REFERENCES public.fiscal_years(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_fiscal_year ON public.journal_entries(fiscal_year_id);
