interface OpenCCModule {
  Converter(options: { from: string; to: string }): (value: string) => string;
}

// opencc-js exposes a CommonJS build for this project's Node16 module setup.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OpenCC = require('opencc-js/t2cn') as OpenCCModule;

const traditionalToSimplified = OpenCC.Converter({
  from: 'twp',
  to: 'cn',
});

/**
 * Converts Taiwan Traditional Chinese search text to the form most downstream
 * sources index, while keeping non-Chinese text unchanged.
 */
export function normalizeSearchQuery(value: string): string {
  return traditionalToSimplified(value.normalize('NFKC'))
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Produces a stable value for title matching without changing displayed text.
 */
export function normalizeSearchComparable(value: string): string {
  return normalizeSearchQuery(value).replace(/\s/g, '').toLowerCase();
}
