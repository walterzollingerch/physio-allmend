-- Rechnungen für Physio Allmend
-- Im Supabase SQL Editor ausführen

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Rechnungsnummer-Sequenz
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Rechnungen
CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text NOT NULL UNIQUE DEFAULT ('R' || LPAD(nextval('invoice_number_seq')::text, 4, '0')),
  customer_name    text NOT NULL DEFAULT '',
  customer_address text NOT NULL DEFAULT '',
  invoice_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date,
  delivery_date    date,
  reference        text,
  bank_info        text DEFAULT 'Migros Bank AG',
  conditions       text DEFAULT 'Zahlung innerhalb 30 Tagen',
  notes            text,
  footer           text,
  discount_type    text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'amount')),
  discount_value   numeric(10,2) NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'gesendet', 'bezahlt', 'storniert')),
  created_by       uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Rechnungspositionen
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  service_name text NOT NULL DEFAULT '',
  description  text,
  unit_price   numeric(10,2) NOT NULL DEFAULT 0,
  quantity     numeric(10,2) NOT NULL DEFAULT 1,
  unit         text NOT NULL DEFAULT 'Stk.'
);

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;

CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "invoice_items_select" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_update" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete" ON public.invoice_items;

CREATE POLICY "invoice_items_select" ON public.invoice_items
  FOR SELECT USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "invoice_items_insert" ON public.invoice_items
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "invoice_items_update" ON public.invoice_items
  FOR UPDATE USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "invoice_items_delete" ON public.invoice_items
  FOR DELETE USING (get_my_role() IN ('admin', 'physio'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
