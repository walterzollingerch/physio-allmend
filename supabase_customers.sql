-- Kunden für Physio Allmend
-- Im Supabase SQL Editor ausführen

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE TABLE IF NOT EXISTS public.customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number text NOT NULL UNIQUE,
  name            text NOT NULL,
  street          text,
  street_number   text,
  postal_code     text,
  city            text,
  country         text DEFAULT 'Schweiz',
  phone           text,
  website         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;

CREATE POLICY "customers_select" ON public.customers
  FOR SELECT USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "customers_delete" ON public.customers
  FOR DELETE USING (get_my_role() = 'admin');

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
