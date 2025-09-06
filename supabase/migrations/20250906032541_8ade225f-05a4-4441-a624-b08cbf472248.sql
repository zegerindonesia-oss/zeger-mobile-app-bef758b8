-- Phase 1: Extend user_role enum with new hierarchical roles (step by step)
-- Add one role at a time to avoid transaction issues

-- First, add the new enum values one by one
DO $$
BEGIN
    -- Add HO roles
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ho_owner' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'ho_owner';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ho_staff' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'ho_staff';
    END IF;
    
    -- Add Branch Hub roles
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bh_staff' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'bh_staff';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bh_kasir' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'bh_kasir';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bh_rider' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'bh_rider';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bh_report' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'bh_report';
    END IF;
    
    -- Add Small Branch roles
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sb_branch_manager' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'sb_branch_manager';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sb_kasir' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'sb_kasir';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sb_rider' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'sb_rider';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sb_report' AND enumtypid = 'user_role'::regtype) THEN
        ALTER TYPE user_role ADD VALUE 'sb_report';
    END IF;
END $$;

-- Create app access type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_access_type') THEN
        CREATE TYPE app_access_type AS ENUM ('web_backoffice', 'pos_app', 'rider_app');
    END IF;
END $$;

-- Add app_access_type column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_access_type app_access_type DEFAULT 'web_backoffice';

-- Update existing roles to have proper app access
UPDATE profiles SET app_access_type = 'web_backoffice' WHERE role IN ('ho_admin', 'branch_manager');
UPDATE profiles SET app_access_type = 'rider_app' WHERE role = 'rider';