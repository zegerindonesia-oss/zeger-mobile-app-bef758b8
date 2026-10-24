import { expect, test } from 'bun:test';
import { customerCategory, moveCustomerCategory, orderCustomerCategories } from '../src/lib/customer-category-order';

test('configured priority drives both category chips and menu sections', () => {
  expect(orderCustomerCategories(['Coffee', 'Promo', 'Tea'], ['Promo', 'Tea', 'Coffee'])).toEqual(['Promo', 'Tea', 'Coffee']);
});
test('new and brand-filtered categories are never hidden by saved ordering', () => {
  expect(orderCustomerCategories(['Coffee', 'New Menu'], ['Promo', 'Coffee'])).toEqual(['Coffee', 'New Menu']);
});
test('subcategory takes precedence, including separate one-liter menus', () => {
  expect(customerCategory({ category: 'Coffee', sub_category: '1 Liter Series' })).toBe('1 Liter Series');
  expect(customerCategory({ category: 'Coffee', sub_category: '  ' })).toBe('Coffee');
});
test('arrow moves change one position and stop at list boundaries', () => {
  expect(moveCustomerCategory(['Coffee', 'Promo', 'Tea'], 'Promo', -1)).toEqual(['Promo', 'Coffee', 'Tea']);
  expect(moveCustomerCategory(['Promo', 'Coffee'], 'Promo', -1)).toEqual(['Promo', 'Coffee']);
});