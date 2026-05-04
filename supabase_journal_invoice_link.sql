-- journal_entries: invoice_id Verknüpfung + DELETE-Policy
-- Im Supabase SQL Editor ausführen

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "physio delete journal_entries" ON public.journal_entries;
CREATE POLICY "physio delete journal_entries"
  ON public.journal_entries FOR DELETE
  USING (get_my_role() IN ('admin', 'physio'));
