-- Accounting tables for Physio Allmend
-- Run this in Supabase SQL Editor

-- Accounts table (Kontenplan)
CREATE TABLE IF NOT EXISTS public.accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      text NOT NULL,           -- Kontonummer
  name        text NOT NULL,           -- Kontobezeichnung
  type        text NOT NULL CHECK (type IN ('aktiv', 'passiv', 'ertrag', 'aufwand')),
  balance     numeric(15,2) NOT NULL DEFAULT 0,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (number)
);

-- Journal entries table (Buchungen)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date         date NOT NULL DEFAULT CURRENT_DATE,
  description  text NOT NULL,
  debit_account_id  uuid NOT NULL REFERENCES public.accounts(id),
  credit_account_id uuid NOT NULL REFERENCES public.accounts(id),
  amount       numeric(15,2) NOT NULL CHECK (amount > 0),
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Accounts: admin and physio can read/write; clients have no access
CREATE POLICY "accounts_select" ON public.accounts
  FOR SELECT USING (get_my_role() IN ('admin', 'physio'));

CREATE POLICY "accounts_insert" ON public.accounts
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));

CREATE POLICY "accounts_update" ON public.accounts
  FOR UPDATE USING (get_my_role() IN ('admin', 'physio'));

CREATE POLICY "accounts_delete" ON public.accounts
  FOR DELETE USING (get_my_role() = 'admin');

-- Journal entries: same access rules
CREATE POLICY "journal_select" ON public.journal_entries
  FOR SELECT USING (get_my_role() IN ('admin', 'physio'));

CREATE POLICY "journal_insert" ON public.journal_entries
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));

CREATE POLICY "journal_delete" ON public.journal_entries
  FOR DELETE USING (get_my_role() = 'admin');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
