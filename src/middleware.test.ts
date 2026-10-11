/** @jest-environment node */

import type { AuthInfo } from '@/lib/auth';

// Jest 27's Node environment does not expose Node 20's Fetch globals, but
// NextRequest/NextResponse expect them while their modules are initialized.
Object.assign(globalThis, require('node:stream/web'));
const { deserialize, serialize } = require('node:v8');
globalThis.structuredClone = <T>(value: T): T =>
  deserialize(serialize(value)) as T;
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: require('node:crypto').webcrypto,
});
const edgeRuntime = require('next/dist/compiled/@edge-runtime/primitives');
Object.assign(globalThis, {
  fetch: edgeRuntime.fetch,
  Headers: edgeRuntime.Headers,
  Request: edgeRuntime.Request,
  Response: edgeRuntime.Response,
});

const { NextRequest } = require('next/server') as {
  NextRequest: typeof import('next/server').NextRequest;
};
const { createAuthSignature, getAuthSignaturePayload, serializeAuthInfo } =
  require('@/lib/auth') as typeof import('@/lib/auth');
const { middleware } = require('@/middleware') as typeof import('@/middleware');

const PASSWORD = 'test-deployment-password';

async function createRequest(signatureOverride?: string) {
  const authInfo: AuthInfo = {
    role: 'user',
    // Deliberately much older than the previous seven-day limit.
    timestamp: Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
  };
  authInfo.signature =
    signatureOverride ??
    (await createAuthSignature(getAuthSignaturePayload(authInfo), PASSWORD));

  return new NextRequest('https://joyflix.example/api/detail', {
    headers: { cookie: `auth=${serializeAuthInfo(authInfo)}` },
  });
}

describe('authentication middleware', () => {
  beforeEach(() => {
    process.env.PASSWORD = PASSWORD;
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'localstorage';
  });

  afterEach(() => {
    delete process.env.PASSWORD;
    delete process.env.NEXT_PUBLIC_STORAGE_TYPE;
  });

  it('accepts an old valid signature and renews its persistent cookie', async () => {
    const response = await middleware(await createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=34560000');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
  });

  it('still rejects a forged signature', async () => {
    const response = await middleware(await createRequest('0'.repeat(64)));

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
