import { describe, it, expect } from 'vitest';
import { collectionInput, cta, eligible, schedule, sectionRules } from './validation.js';
import { permutation } from './service.js';
describe('CMS validation', () => {
  it('validates collection input with direct image URLs and slugs', () => {
    const valid = collectionInput.parse({
      name: 'Royal Polki Edit',
      slug: 'royal-polki-edit',
      description: 'Handcrafted jewellery curation',
      imageUrl: 'https://res.cloudinary.com/test/image/upload/sample.webp',
      imagePublicId: 'showroom/cms/collections/uuid',
      visible: true,
      bridal: true,
      publication: 'PUBLISHED',
      seoTitle: 'Royal Polki | Shree Ram Jewellers',
      seoDescription: 'Handcrafted uncut polki diamond necklaces.'
    });
    expect(valid.name).toBe('Royal Polki Edit');
    expect(valid.slug).toBe('royal-polki-edit');
    expect(valid.imageUrl).toBe('https://res.cloudinary.com/test/image/upload/sample.webp');

    expect(() => collectionInput.parse({ name: '', slug: 'invalid' })).toThrow();
    expect(() => collectionInput.parse({ name: 'Valid', slug: 'INVALID SLUG!' })).toThrow();
  });
  it('uses inclusive starts and exclusive ends in UTC', () => {
    const now = new Date('2026-11-02T10:00:00Z');
    expect(eligible({ startsAt: '2026-11-02T15:30:00+05:30' }, now)).toBe(true);
    expect(eligible({ endsAt: now }, now)).toBe(false);
    expect(eligible({}, now)).toBe(true);
    expect(() => schedule({ startsAt: now, endsAt: now })).toThrow();
  });
  it('rejects unsafe CTA paths', () => {
    for (const value of ['javascript:alert(1)', '//evil.test', '/\\evil', '/%2f%2fevil', 'https://external.test']) expect(cta.safeParse(value).success).toBe(false);
    expect(cta.parse('/collections/bridal')).toBe('/collections/bridal');
  });
  it('validates each section type and exact reorder membership', () => {
    for (const type of ['HERO', 'PROMOTIONAL', 'BRIDAL', 'EDITORIAL', 'APPOINTMENT', 'CUSTOM_JEWELLERY'] as const) expect(() => sectionRules({ type, heading: 'Heading', internalName: 'Internal' })).toThrow();
    for (const type of ['FEATURED_COLLECTIONS', 'FEATURED_PRODUCTS', 'NEW_ARRIVALS'] as const) expect(() => sectionRules({ type, heading: 'Heading', internalName: 'Internal' })).not.toThrow();
    expect(() => permutation(['a', 'a'], ['a', 'b'])).toThrow();
    expect(() => permutation(['a'], ['a', 'b'])).toThrow();
    expect(() => permutation(['b', 'a'], ['a', 'b'])).not.toThrow();
  });
});
