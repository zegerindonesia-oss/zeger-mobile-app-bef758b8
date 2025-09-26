-- Step 1: Add new hierarchical roles to existing enum (without breaking existing ones)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '1_HO_Admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '1_HO_Owner'; 
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '1_HO_Staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '2_Hub_Branch_Manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '2_Hub_Staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '2_Hub_Kasir';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '2_Hub_Rider';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '3_SB_Branch_Manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '3_SB_Staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '3_SB_Kasir';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '3_SB_Rider';

-- Step 2: Update branches table to support hierarchy
ALTER TABLE branches ADD COLUMN IF NOT EXISTS level integer DEFAULT 2;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS parent_branch_id uuid REFERENCES branches(id);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_code text;

-- Update existing branches to level 2 (Hub level) 
UPDATE branches SET level = 2 WHERE level IS NULL;

-- Step 3: Create branch hierarchy constraints
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_branch_hierarchy') THEN
    ALTER TABLE branches ADD CONSTRAINT valid_branch_hierarchy 
      CHECK (
        (level = 1 AND parent_branch_id IS NULL) OR  -- HO has no parent
        (level = 2 AND parent_branch_id IS NULL) OR  -- Hub has no parent  
        (level = 3 AND parent_branch_id IS NOT NULL) -- Small branch has parent
      );
  END IF;
END $$;

-- Step 4: Create user permissions table for granular access control
CREATE TABLE IF NOT EXISTS user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  permission_type text NOT NULL, -- view, create, edit, delete, approve
  is_granted boolean DEFAULT false,
  resource_filter jsonb DEFAULT '{"type": "all"}'::jsonb, -- all, branch, rider_specific
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, module_name, permission_type)
);

-- Enable RLS on new table
ALTER TABLE user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Step 5: Create role hierarchy helper functions
CREATE OR REPLACE FUNCTION public.get_user_level(user_role_param user_role)
RETURNS integer AS $$
BEGIN
  CASE 
    WHEN user_role_param::text LIKE '1_%' THEN RETURN 1;
    WHEN user_role_param::text LIKE '2_%' THEN RETURN 2;  
    WHEN user_role_param::text LIKE '3_%' THEN RETURN 3;
    -- Map old roles to levels for compatibility
    WHEN user_role_param = 'ho_admin' OR user_role_param = 'ho_owner' THEN RETURN 1;
    WHEN user_role_param = 'branch_manager' THEN RETURN 2;
    WHEN user_role_param = 'sb_branch_manager' THEN RETURN 3;
    WHEN user_role_param = 'rider' THEN RETURN 2;
    ELSE RETURN 99;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.can_manage_role(manager_role user_role, target_role user_role)
RETURNS boolean AS $$
BEGIN
  -- HO can manage everyone
  IF get_user_level(manager_role) = 1 THEN
    RETURN true;
  END IF;
  
  -- Hub can manage Small Branch roles only
  IF get_user_level(manager_role) = 2 THEN
    RETURN get_user_level(target_role) = 3;
  END IF;
  
  -- Small Branch cannot manage anyone
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;