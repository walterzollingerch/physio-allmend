-- ============================================================
-- Soft-Delete für invoices und customers
-- Führe dieses Script im Supabase SQL Editor aus
-- ============================================================

-- 1. Spalten hinzufügen
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- 2. Indizes für performante Filterung
CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted
  ON public.invoices (is_deleted)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_customers_not_deleted
  ON public.customers (is_deleted)
  WHERE is_deleted = false;

-- 3. Bestehende Einträge explizit auf false setzen (Sicherheit)
UPDATE public.invoices  SET is_deleted = false WHERE is_deleted IS NULL;
UPDATE public.customers SET is_deleted = false WHERE is_deleted IS NULL;
