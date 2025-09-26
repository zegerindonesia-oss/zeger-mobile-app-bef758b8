-- Fix security issue: Add RLS policies for user_module_permissions table

-- Users can view own permissions
CREATE POLICY "Users can view own permissions" ON user_module_permissions
  FOR SELECT USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Level 1-2 users can manage permissions  
CREATE POLICY "Level 1-2 can manage permissions" ON user_module_permissions  
  FOR ALL USING (
    get_user_level(get_current_user_role()) <= 2
  );

-- Insert default permission templates for existing users
INSERT INTO user_module_permissions (user_id, module_name, permission_type, is_granted)
SELECT 
  p.id,
  module.name,
  perm.type,
  CASE 
    WHEN get_user_level(p.role) = 1 THEN true  -- HO gets all permissions
    WHEN get_user_level(p.role) = 2 AND module.name IN ('Dashboard', 'Sales', 'Inventory', 'Reports') THEN true
    WHEN get_user_level(p.role) = 3 AND module.name IN ('Dashboard', 'Sales') AND perm.type IN ('view', 'create') THEN true
    ELSE false
  END
FROM profiles p
CROSS JOIN (
  VALUES ('Dashboard'), ('Sales'), ('Inventory'), ('Finance'), ('Reports'), ('Admin'), ('Settings')
) AS module(name)
CROSS JOIN (
  VALUES ('view'), ('create'), ('edit'), ('delete'), ('approve')  
) AS perm(type)
WHERE p.role != 'customer'::user_role
ON CONFLICT (user_id, module_name, permission_type) DO NOTHING;