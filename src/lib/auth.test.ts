import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AuthInfo,
  serializeAuthInfo,
} from '@/lib/auth';

describe('persistent authentication', () => {
  it('uses the Chromium maximum persistent-cookie lifetime', () => {
    expect(AUTH_COOKIE_MAX_AGE_SECONDS).toBe(400 * 24 * 60 * 60);
  });

  it('serializes signed authentication data for a cookie round trip', () => {
    const authInfo: AuthInfo = {
      username: 'viewer',
      role: 'user',
      timestamp: 1_700_000_000_000,
      signature: 'a'.repeat(64),
    };

    expect(JSON.parse(decodeURIComponent(serializeAuthInfo(authInfo)))).toEqual(
      authInfo
    );
  });
});
