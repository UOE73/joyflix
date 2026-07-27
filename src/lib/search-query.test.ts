import {
  normalizeSearchComparable,
  normalizeSearchQuery,
} from '@/lib/search-query';

describe('search query normalization', () => {
  it('converts Taiwan Traditional Chinese to Simplified Chinese', () => {
    expect(normalizeSearchQuery('慶餘年')).toBe('庆余年');
    expect(normalizeSearchQuery('軟體滑鼠')).toBe('软件鼠标');
  });

  it('preserves non-Chinese text and normalizes whitespace', () => {
    expect(normalizeSearchQuery('  慶餘年   2024  ')).toBe('庆余年 2024');
  });

  it('matches Traditional and Simplified titles consistently', () => {
    expect(normalizeSearchComparable('慶 餘 年 Ａ')).toBe(
      normalizeSearchComparable('庆余年 a')
    );
  });
});
