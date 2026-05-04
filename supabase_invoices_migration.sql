-- Migration: Rechnungen erweitern
-- Im Supabase SQL Editor ausführen

-- 1. Ertragskonto pro Rechnungsposition
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);

-- 2. Status 'storniert' → 'archiviert'
--    Check-Constraint ersetzen
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('entwurf', 'gesendet', 'bezahlt', 'archiviert'));

-- Bestehende 'storniert'-Datensätze migrieren
UPDATE public.invoices SET status = 'archiviert' WHERE status = 'storniert';

-- 3. RLS für journal_entries (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date              date NOT NULL,
  description       text NOT NULL,
  debit_account_id  uuid NOT NULL REFERENCES public.accounts(id),
  credit_account_id uuid NOT NULL REFERENCES public.accounts(id),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  created_by        uuid REFERENCES public.profiles(id),
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "physio read journal_entries"   ON public.journal_entries;
DROP POLICY IF EXISTS "physio insert journal_entries" ON public.journal_entries;

CREATE POLICY "physio read journal_entries"
  ON public.journal_entries FOR SELECT
  USING (get_my_role() IN ('admin', 'physio'));

CREATE POLICY "physio insert journal_entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'physio'));
