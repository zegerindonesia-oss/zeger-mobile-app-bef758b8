export const TABLE_MANAGEMENT_ROLES = ['ho_admin', 'ho_owner', '1_HO_Admin', '1_HO_Owner', 'branch_manager', 'sb_branch_manager', '2_Hub_Branch_Manager', '3_SB_Branch_Manager'];

export const canChooseTableBranch = (role: string) =>
  ['ho_admin', 'ho_owner', '1_HO_Admin', '1_HO_Owner'].includes(role);