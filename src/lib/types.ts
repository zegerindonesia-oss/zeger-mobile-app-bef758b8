// Shared type definitions for the application

export type UserRole = 
  // Level 1: Head Office (new hierarchical)
  | '1_HO_Admin' | '1_HO_Owner' | '1_HO_Staff'
  // Level 2: Branch Hub (new hierarchical)  
  | '2_Hub_Branch_Manager' | '2_Hub_Staff' | '2_Hub_Kasir' | '2_Hub_Rider'
  // Level 3: Small Branch (new hierarchical)
  | '3_SB_Branch_Manager' | '3_SB_Staff' | '3_SB_Kasir' | '3_SB_Rider'
  // Legacy roles (for backwards compatibility)
  | 'ho_admin' | 'ho_owner' | 'ho_staff' | 'branch_manager' | 'bh_staff' | 'bh_kasir' | 'bh_rider' | 'bh_report' | 'sb_branch_manager' | 'sb_kasir' | 'sb_rider' | 'sb_report' | 'rider' | 'finance' | 'customer';

// Helper function to get user level from role
export const getUserLevel = (role: UserRole): number => {
  if (role.startsWith('1_')) return 1; // HO level
  if (role.startsWith('2_')) return 2; // Hub level  
  if (role.startsWith('3_')) return 3; // Small Branch level
  // Legacy role mapping
  if (['ho_admin', 'ho_owner', 'ho_staff'].includes(role)) return 1;
  if (['branch_manager', 'bh_staff', 'bh_kasir', 'bh_rider'].includes(role)) return 2;
  if (['sb_branch_manager', 'sb_kasir', 'sb_rider'].includes(role)) return 3;
  return 99;
};

// Check if user can manage another user's role
export const canManageRole = (managerRole: UserRole, targetRole: UserRole): boolean => {
  const managerLevel = getUserLevel(managerRole);
  const targetLevel = getUserLevel(targetRole);
  
  // HO can manage everyone
  if (managerLevel === 1) return true;
  
  // Hub can manage Small Branch roles only
  if (managerLevel === 2) return targetLevel === 3;
  
  // Small Branch cannot manage anyone
  return false;
};

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  branch_id?: string;
  is_active: boolean;
  app_access_type?: 'web_backoffice' | 'pos_app' | 'rider_app';
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  level: number;
  parent_branch_id?: string;
  branch_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}