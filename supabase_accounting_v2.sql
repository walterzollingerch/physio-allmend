-- Buchhaltung v2: Kontengruppen & Geschäftsjahre
-- Im Supabase SQL Editor ausführen

-- get_my_role sicherstellen
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1) Kontengruppen
CREATE TABLE IF NOT EXISTS public.account_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('aktiv', 'passiv', 'ertrag', 'aufwand')),
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_groups_select" ON public.account_groups
  FOR SELECT USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "account_groups_insert" ON public.account_groups
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "account_groups_update" ON public.account_groups
  FOR UPDATE USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "account_groups_delete" ON public.account_groups
  FOR DELETE USING (get_my_role() = 'admin');

-- 2) Geschäftsjahre
CREATE TABLE IF NOT EXISTS public.fiscal_years (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  is_closed   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_years_select" ON public.fiscal_years
  FOR SELECT USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "fiscal_years_insert" ON public.fiscal_years
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "fiscal_years_update" ON public.fiscal_years
  FOR UPDATE USING (get_my_role() IN ('admin', 'physio'));
CREATE POLICY "fiscal_years_delete" ON public.fiscal_years
  FOR DELETE USING (get_my_role() = 'admin');

-- 3) Accounts – group_id hinzufügen (falls Tabelle schon existiert)
CREATE TABLE IF NOT EXISTS public.accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      text NOT NULL,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('aktiv', 'passiv', 'ertrag', 'aufwand')),
  group_id    uuid REFERENCES public.account_groups(id) ON DELETE SET NULL,
  balance     numeric(15,2) NOT NULL DEFAULT 0,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (number)
);

-- Falls accounts schon existiert, group_id ergänzen
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS
  group_id uuid REFERENCES public.account_groups(id) ON DELETE SET NULL;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='accounts_select') THEN
    CREATE POLICY "accounts_select" ON public.accounts FOR SELECT USING (get_my_role() IN ('admin', 'physio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='accounts_insert') THEN
    CREATE POLICY "accounts_insert" ON public.accounts FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='accounts_update') THEN
    CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE USING (get_my_role() IN ('admin', 'physio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accounts' AND policyname='accounts_delete') THEN
    CREATE POLICY "accounts_delete" ON public.accounts FOR DELETE USING (get_my_role() = 'admin');
  END IF;
END $$;

-- 4) Journal entries (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date              date NOT NULL DEFAULT CURRENT_DATE,
  description       text NOT NULL,
  debit_account_id  uuid NOT NULL REFERENCES public.accounts(id),
  credit_account_id uuid NOT NULL REFERENCES public.accounts(id),
  amount            numeric(15,2) NOT NULL CHECK (amount > 0),
  fiscal_year_id    uuid REFERENCES public.fiscal_years(id),
  created_by        uuid REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='journal_entries' AND policyname='journal_select') THEN
    CREATE POLICY "journal_select" ON public.journal_entries FOR SELECT USING (get_my_role() IN ('admin', 'physio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='journal_entries' AND policyname='journal_insert') THEN
    CREATE POLICY "journal_insert" ON public.journal_entries FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'physio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='journal_entries' AND policyname='journal_delete') THEN
    CREATE POLICY "journal_delete" ON public.journal_entries FOR DELETE USING (get_my_role() = 'admin');
  END IF;
END $$;

-- 5) updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS accounts_updated_at ON public.accounts;
CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
