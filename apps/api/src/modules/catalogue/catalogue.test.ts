import { describe, expect, it } from 'vitest';
import { listQuery } from './validation.js';

describe('Catalogue listQuery validation', () => {
  it('parses valid list queries with category and categoryId', () => {
    const q1 = listQuery.parse({ categoryId: 'necklaces' });
    expect(q1.categoryId).toBe('necklaces');

    const q2 = listQuery.parse({ category: 'necklaces' });
    expect(q2.category).toBe('necklaces');

    const q3 = listQuery.parse({ search: 'necklaces', page: '2', limit: '10' });
    expect(q3.search).toBe('necklaces');
    expect(q3.page).toBe(2);
    expect(q3.limit).toBe(10);
  });

  it('enforces limit and page boundaries', () => {
    expect(() => listQuery.parse({ page: '0' })).toThrow();
    expect(() => listQuery.parse({ limit: '500' })).toThrow();
  });

  it('validates price and weight ranges', () => {
    const valid = listQuery.parse({ minPrice: '1000', maxPrice: '5000' });
    expect(valid.minPrice).toBe(1000);
    expect(valid.maxPrice).toBe(5000);

    expect(() => listQuery.parse({ minPrice: '5000', maxPrice: '1000' })).toThrow();
  });
});

