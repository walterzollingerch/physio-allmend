-- Rundungsdifferenz-Feld zur invoices-Tabelle hinzufügen
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS rounding_diff numeric(10,2) NOT NULL DEFAULT 0;
