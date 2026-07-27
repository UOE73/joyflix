/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useTheme } from 'next-themes'; // Import useTheme
import { ThemeProvider } from '@/components/ThemeProvider'; // Add this import

import { useSite } from '@/components/SiteProvider';
import { Eye, EyeOff } from 'lucide-react';
import { setBrowserAuthInfo } from '@/lib/auth';

function getSafeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';

  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

function LoginPageClient() {
  const { setTheme } = useTheme(); // Destructure setTheme
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { siteName } = useSite();

  // 在客户端挂载后设置配置
  useEffect(() => {
    // Load remembered username
    if (typeof window !== 'undefined') {
      const rememberedUsername = localStorage.getItem('rememberedUsername');
      if (rememberedUsername) {
        setUsername(rememberedUsername);
        setRememberMe(true); // Check remember me if username is found
      }
      // 舊版本曾保存明文密碼；升級後立即移除。
      localStorage.removeItem('rememberedPassword');

      const storageType = (window as any).RUNTIME_CONFIG?.STORAGE_TYPE;
      setShouldAskUsername(storageType && storageType !== 'localstorage');
    }
  }, [setTheme]); // Add setTheme to dependency array

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBrowserAuthInfo(data.user || { role: 'user' });

        // 瀏覽器密碼管理器負責密碼；這裡只記住非敏感的使用者名稱。
        if (rememberMe && username) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        router.replace(getSafeRedirect(searchParams.get('redirect')));
      } else if (res.status === 401) {
        setError('密码错误');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '服务器错误');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full sm:max-w-md lg:max-w-md rounded-3xl bg-black bg-opacity-70 p-10 shadow-2xl animate-slideUp">
      <h1 className="mb-8 text-center text-4xl font-bold text-white">
        {siteName}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {shouldAskUsername && (
          <div className="relative">
            <input
              id="username"
              type="text"
              autoComplete="username"
              className="block w-full rounded-md border border-gray-400 bg-transparent py-3 px-4 text-white focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-white sm:text-base"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        )}

        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="block w-full rounded-md border border-gray-400 bg-transparent py-3 px-4 text-white focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-white sm:text-base"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-white focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="hidden peer" // Hide default, add peer
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label
              htmlFor="remember-me"
              className="flex items-center cursor-pointer"
            >
              <div className="w-4 h-4 border-2 border-gray-300 rounded flex items-center justify-center peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all duration-200">
                {rememberMe && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="ml-2 text-sm text-gray-300">记住我</span>
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* 登录 / 注册按钮 */}
        <button
          type="submit"
          disabled={!password || loading || (shouldAskUsername && !username)}
          className="inline-flex w-full justify-center rounded-lg bg-blue-400/70 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-blue-500/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ThemeProvider forcedTheme="dark">
        <LoginPageClient />
      </ThemeProvider>
    </Suspense>
  );
}
