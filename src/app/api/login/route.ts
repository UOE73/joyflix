/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AuthInfo,
  createAuthSignature,
  getAuthSignaturePayload,
  isSecureRequest,
  serializeAuthInfo,
} from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'edge';

// 读取存储类型环境变量，默认 localstorage
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | undefined) || 'localstorage';

// 生成不包含密码、具有完整性与有效期保护的认证 Cookie。
async function generateAuthCookie(
  username?: string,
  role: 'owner' | 'admin' | 'user' = 'user'
): Promise<string> {
  const secret = process.env.PASSWORD;
  if (!secret) throw new Error('PASSWORD is not configured');

  const authData: AuthInfo = {
    ...(username ? { username } : {}),
    role,
    timestamp: Date.now(),
  };
  authData.signature = await createAuthSignature(
    getAuthSignaturePayload(authData),
    secret
  );
  return serializeAuthInfo(authData);
}

async function createLoginResponse(
  req: NextRequest,
  username: string | undefined,
  role: 'owner' | 'admin' | 'user'
) {
  const response = NextResponse.json({
    ok: true,
    user: { ...(username ? { username } : {}), role },
  });
  const cookieValue = await generateAuthCookie(username, role);

  response.cookies.set('auth', cookieValue, {
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
    secure: isSecureRequest(req),
  });
  return response;
}

export async function POST(req: NextRequest) {
  try {
    // 本地 / localStorage 模式——仅校验固定密码
    if (STORAGE_TYPE === 'localstorage') {
      const envPassword = process.env.PASSWORD;

      // 未配置 PASSWORD 时直接放行
      if (!envPassword) {
        const response = NextResponse.json({
          ok: true,
          user: { role: 'user' },
        });

        // 清除可能存在的认证cookie
        response.cookies.set('auth', '', {
          path: '/',
          expires: new Date(0),
          sameSite: 'lax',
          httpOnly: true,
          secure: isSecureRequest(req),
        });

        return response;
      }

      const { password } = await req.json();
      if (typeof password !== 'string') {
        return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
      }

      if (password !== envPassword) {
        return NextResponse.json(
          { ok: false, error: '密码错误' },
          { status: 401 }
        );
      }

      return createLoginResponse(req, undefined, 'user');
    }

    // 数据库 / redis 模式——校验用户名并尝试连接数据库
    const { username, password } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    // 可能是超管，直接读环境变量
    if (
      username === process.env.USERNAME &&
      password === process.env.PASSWORD
    ) {
      return createLoginResponse(req, username, 'owner');
    } else if (username === process.env.USERNAME) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const config = await getConfig();
    const user = config.UserConfig.Users.find((u) => u.username === username);
    if (user && user.banned) {
      return NextResponse.json({ error: '用户被封禁' }, { status: 401 });
    }

    // 校验用户密码
    try {
      const pass = await db.verifyUser(username, password);
      if (!pass) {
        return NextResponse.json(
          { error: '用户名或密码错误' },
          { status: 401 }
        );
      }

      return createLoginResponse(req, username, user?.role || 'user');
    } catch (err) {
      console.error('数据库验证失败', err);
      return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('登录接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
