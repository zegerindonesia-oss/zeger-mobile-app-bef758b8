
-- Add branch_manager to products INSERT/UPDATE/DELETE policies
-- First check existing policies and add new ones

-- Allow branch_manager to insert products
CREATE POLICY "Branch managers can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('ho_admin', 'branch_manager', 'sb_branch_manager', '1_HO_Admin', '1_HO_Owner', '2_Hub_Branch_Manager', '3_SB_Branch_Manager')
    AND profiles.is_active = true
  )
);

-- Allow branch_manager to update products
CREATE POLICY "Branch managers can update products"
ON public.products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('ho_admin', 'branch_manager', 'sb_branch_manager', '1_HO_Admin', '1_HO_Owner', '2_Hub_Branch_Manager', '3_SB_Branch_Manager')
    AND profiles.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('ho_admin', 'branch_manager', 'sb_branch_manager', '1_HO_Admin', '1_HO_Owner', '2_Hub_Branch_Manager', '3_SB_Branch_Manager')
    AND profiles.is_active = true
  )
);

-- Allow branch_manager to delete products
CREATE POLICY "Branch managers can delete products"
ON public.products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('ho_admin', 'branch_manager', 'sb_branch_manager', '1_HO_Admin', '1_HO_Owner', '2_Hub_Branch_Manager', '3_SB_Branch_Manager')
    AND profiles.is_active = true
  )
);
