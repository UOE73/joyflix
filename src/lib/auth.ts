import type { NextRequest } from 'next/server';

export type AuthRole = 'owner' | 'admin' | 'user';

export interface AuthInfo {
  username?: string;
  role: AuthRole;
  signature?: string;
  timestamp?: number;
}

const BROWSER_AUTH_KEY = 'joyflixAuthInfo';
// Chromium caps persistent cookies at 400 days. Middleware renews this window
// after every authenticated request, while the signed value itself does not
// expire merely because time passed. This also keeps TV clients that persist
// the cookie value from being forced to re-enter a password periodically.
export const AUTH_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'owner' || value === 'admin' || value === 'user';
}

function parseAuthInfo(value: string): AuthInfo | null {
  try {
    const parsed = JSON.parse(value) as Partial<AuthInfo>;
    if (!isAuthRole(parsed.role)) return null;
    if (parsed.username !== undefined && typeof parsed.username !== 'string') {
      return null;
    }
    if (
      parsed.signature !== undefined &&
      typeof parsed.signature !== 'string'
    ) {
      return null;
    }
    if (
      parsed.timestamp !== undefined &&
      typeof parsed.timestamp !== 'number'
    ) {
      return null;
    }
    return parsed as AuthInfo;
  } catch {
    return null;
  }
}

// 從 HttpOnly Cookie 取得認證資訊（伺服器端使用）。
export function getAuthInfoFromCookie(request: NextRequest): AuthInfo | null {
  const authCookie = request.cookies.get('auth');
  if (!authCookie) return null;

  try {
    return parseAuthInfo(decodeURIComponent(authCookie.value));
  } catch {
    return null;
  }
}

export function serializeAuthInfo(authInfo: AuthInfo): string {
  return encodeURIComponent(JSON.stringify(authInfo));
}

export function getAuthSignaturePayload(
  authInfo: Pick<AuthInfo, 'username' | 'role' | 'timestamp'>
): string {
  return [
    'v2',
    authInfo.username || '',
    authInfo.role,
    String(authInfo.timestamp || 0),
  ].join(':');
}

export async function createAuthSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyAuthSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signatureBytes = new Uint8Array(
      signature.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );

    return crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(payload)
    );
  } catch {
    return false;
  }
}

export function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  return forwardedProto === 'https' || request.nextUrl.protocol === 'https:';
}

// 客戶端只保存顯示及快取分區所需的非敏感身份資料。
export function getAuthInfoFromBrowserCookie(): AuthInfo | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(BROWSER_AUTH_KEY);
  return stored ? parseAuthInfo(stored) : null;
}

export function setBrowserAuthInfo(
  authInfo: Pick<AuthInfo, 'username' | 'role'>
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    BROWSER_AUTH_KEY,
    JSON.stringify({
      ...(authInfo.username ? { username: authInfo.username } : {}),
      role: authInfo.role,
    })
  );
}

export function clearBrowserAuthInfo(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BROWSER_AUTH_KEY);
}
