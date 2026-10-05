CREATE TABLE public.pos_table_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_table_sections TO authenticated;
GRANT ALL ON public.pos_table_sections TO service_role;
ALTER TABLE public.pos_table_sections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pos_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  section_id uuid REFERENCES public.pos_table_sections(id) ON DELETE SET NULL,
  table_number text NOT NULL,
  capacity int NOT NULL DEFAULT 4,
  shape text NOT NULL DEFAULT 'square',
  status text NOT NULL DEFAULT 'available',
  guest_name text,
  guest_count int,
  occupied_at timestamptz,
  current_total numeric NOT NULL DEFAULT 0,
  open_bill jsonb,
  merged_into uuid REFERENCES public.pos_tables(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, table_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_tables TO authenticated;
GRANT ALL ON public.pos_tables TO service_role;
ALTER TABLE public.pos_tables ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pos_table_status_check() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('available','occupied','billing','reserved') THEN
    RAISE EXCEPTION 'Invalid table status %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pos_tables_check BEFORE INSERT OR UPDATE ON public.pos_tables FOR EACH ROW EXECUTE FUNCTION public.pos_table_status_check();

CREATE POLICY "Branch staff manage sections" ON public.pos_table_sections FOR ALL TO authenticated
USING (has_role('ho_admin'::user_role) OR branch_id = get_current_user_branch())
WITH CHECK (has_role('ho_admin'::user_role) OR branch_id = get_current_user_branch());

CREATE POLICY "Branch staff manage tables" ON public.pos_tables FOR ALL TO authenticated
USING (has_role('ho_admin'::user_role) OR branch_id = get_current_user_branch())
WITH CHECK (has_role('ho_admin'::user_role) OR branch_id = get_current_user_branch());

ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_tables;