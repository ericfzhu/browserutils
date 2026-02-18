import { describe, it, expect } from 'vitest';
import {
  isBuiltInCategory,
  getCategoryInfo,
  getCategoryInfoWithOverrides,
  getCategoryForDomain,
  BUILTIN_CATEGORY_IDS,
} from './categories';
import { CustomCategory } from './types';

describe('isBuiltInCategory', () => {
  it('returns true for built-in categories', () => {
    expect(isBuiltInCategory('social')).toBe(true);
    expect(isBuiltInCategory('entertainment')).toBe(true);
    expect(isBuiltInCategory('news')).toBe(true);
    expect(isBuiltInCategory('shopping')).toBe(true);
    expect(isBuiltInCategory('productivity')).toBe(true);
    expect(isBuiltInCategory('development')).toBe(true);
    expect(isBuiltInCategory('education')).toBe(true);
    expect(isBuiltInCategory('communication')).toBe(true);
    expect(isBuiltInCategory('other')).toBe(true);
  });

  it('returns false for non-built-in categories', () => {
    expect(isBuiltInCategory('custom-uuid-123')).toBe(false);
    expect(isBuiltInCategory('random')).toBe(false);
    expect(isBuiltInCategory('')).toBe(false);
  });
});

describe('getCategoryInfo', () => {
  it('returns correct info for built-in categories', () => {
    const social = getCategoryInfo('social');
    expect(social.id).toBe('social');
    expect(social.name).toBe('Social Media');
    expect(social.color).toBe('bg-pink-500');
  });

  it('returns "other" category for unknown IDs', () => {
    const unknown = getCategoryInfo('unknown-category');
    expect(unknown.id).toBe('other');
    expect(unknown.name).toBe('Other');
  });

  it('returns all built-in categories correctly', () => {
    BUILTIN_CATEGORY_IDS.forEach(id => {
      const info = getCategoryInfo(id);
      expect(info.id).toBe(id);
      expect(info.name).toBeTruthy();
      expect(info.color).toBeTruthy();
    });
  });
});

describe('getCategoryInfoWithOverrides', () => {
  const customCategories: CustomCategory[] = [
    { id: 'custom-1', name: 'My Custom', color: 'bg-red-500', order: 0 },
    { id: 'custom-2', name: 'Another Custom', color: 'bg-blue-500', order: 1 },
  ];

  const builtInOverrides = {
    'social': 'Socials',
    'entertainment': 'Fun Stuff',
  };

  it('returns custom category when it exists', () => {
    const result = getCategoryInfoWithOverrides('custom-1', customCategories, {});
    expect(result.id).toBe('custom-1');
    expect(result.name).toBe('My Custom');
    expect(result.color).toBe('bg-red-500');
  });

  it('returns built-in category with override name', () => {
    const result = getCategoryInfoWithOverrides('social', [], builtInOverrides);
    expect(result.id).toBe('social');
    expect(result.name).toBe('Socials');
    expect(result.color).toBe('bg-pink-500'); // Original color preserved
  });

  it('returns built-in category with original name when no override', () => {
    const result = getCategoryInfoWithOverrides('development', [], builtInOverrides);
    expect(result.id).toBe('development');
    expect(result.name).toBe('Development');
  });

  it('returns "other" for unknown category', () => {
    const result = getCategoryInfoWithOverrides('unknown', [], {});
    expect(result.id).toBe('other');
    expect(result.name).toBe('Other');
  });

  it('prefers custom category over built-in with same ID', () => {
    const customWithBuiltInId: CustomCategory[] = [
      { id: 'social', name: 'Custom Social', color: 'bg-green-500', order: 0 },
    ];
    const result = getCategoryInfoWithOverrides('social', customWithBuiltInId, {});
    expect(result.name).toBe('Custom Social');
    expect(result.color).toBe('bg-green-500');
  });
});

describe('getCategoryForDomain', () => {
  it('returns user override when present', () => {
    const overrides = { 'example.com': 'custom-category' };
    expect(getCategoryForDomain('example.com', overrides)).toBe('custom-category');
  });

  it('normalizes www prefix and checks overrides', () => {
    const overrides = { 'example.com': 'custom-category' };
    expect(getCategoryForDomain('www.example.com', overrides)).toBe('custom-category');
  });

  it('returns default category for known domains', () => {
    expect(getCategoryForDomain('twitter.com', {})).toBe('social');
    expect(getCategoryForDomain('youtube.com', {})).toBe('entertainment');
    expect(getCategoryForDomain('github.com', {})).toBe('development');
    expect(getCategoryForDomain('amazon.com', {})).toBe('shopping');
  });

  it('returns "other" for unknown domains', () => {
    expect(getCategoryForDomain('unknown-site.com', {})).toBe('other');
    expect(getCategoryForDomain('my-personal-site.org', {})).toBe('other');
  });

  it('user override takes precedence over default', () => {
    const overrides = { 'twitter.com': 'custom-work' };
    expect(getCategoryForDomain('twitter.com', overrides)).toBe('custom-work');
  });

  it('handles domains with www in default mappings', () => {
    // Both www and non-www should work
    expect(getCategoryForDomain('facebook.com', {})).toBe('social');
    expect(getCategoryForDomain('www.facebook.com', {})).toBe('social');
  });
});
