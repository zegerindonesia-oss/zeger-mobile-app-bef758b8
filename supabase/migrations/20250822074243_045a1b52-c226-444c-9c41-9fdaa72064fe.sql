-- Allow branch managers to create and manage riders within their branch
-- This extends existing profiles RLS so managers can operate on their branch staff

-- Policy: Branch managers can insert rider profiles in their branch
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Branch managers can insert riders in their branch'
  ) THEN
    CREATE POLICY "Branch managers can insert riders in their branch"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
      get_current_user_role() = 'branch_manager'::user_role
      AND branch_id = get_current_user_branch()
      AND role = 'rider'::user_role
    );
  END IF;
END $$;

-- Policy: Branch managers can update profiles in their branch (e.g., activate/deactivate riders)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Branch managers can update branch staff'
  ) THEN
    CREATE POLICY "Branch managers can update branch staff"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
      get_current_user_role() = 'branch_manager'::user_role
      AND branch_id = get_current_user_branch()
    );
  END IF;
END $$;