const PRIVATE_HOST_SUFFIXES = [
  '.internal',
  '.local',
  '.localhost',
  '.lan',
  '.home',
];

function isPrivateIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;
  const parts = hostname.split('.').map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!normalized.includes(':')) return false;
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('::ffff:')
  );
}

export function parsePublicHttpUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 2048) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;

    const hostname = url.hostname.replace(/\.$/, '').toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === 'metadata.google.internal' ||
      PRIVATE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
      isPrivateIpv4(hostname) ||
      isPrivateIpv6(hostname)
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function isDoubanImageUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return (
    url.protocol === 'https:' &&
    (hostname === 'doubanio.com' || hostname.endsWith('.doubanio.com'))
  );
}

export function matchesConfiguredEndpoint(
  target: URL,
  configuredValue: string
): boolean {
  const configured = parsePublicHttpUrl(configuredValue);
  if (!configured) return false;
  const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/';
  return (
    target.origin === configured.origin &&
    normalizePath(target.pathname) === normalizePath(configured.pathname)
  );
}
