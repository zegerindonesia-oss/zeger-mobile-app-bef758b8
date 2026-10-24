import { describe, expect, test } from 'bun:test';
import { canChooseTableBranch, TABLE_MANAGEMENT_ROLES } from '../src/lib/table-management';

describe('Back Office table management', () => {
  test('HO admin and owner can choose a branch', () => {
    for (const role of ['ho_admin', 'ho_owner', '1_HO_Admin', '1_HO_Owner']) expect(canChooseTableBranch(role)).toBe(true);
  });
  test('branch managers are restricted to their branch', () => {
    for (const role of ['branch_manager', 'sb_branch_manager', '2_Hub_Branch_Manager', '3_SB_Branch_Manager']) expect(canChooseTableBranch(role)).toBe(false);
  });
  test('cashiers and customers cannot open Back Office table settings', () => {
    for (const role of ['bh_kasir', 'sb_kasir', '2_Hub_Kasir', '3_SB_Kasir', 'customer']) expect(TABLE_MANAGEMENT_ROLES.includes(role)).toBe(false);
  });
});