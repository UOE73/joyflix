import { NextRequest, NextResponse } from 'next/server';

import { getUpstashRedisClient } from '@/lib/upstash.db';

const RECOMMENDATIONS_KEY = 'recommendations:movie_titles_cache';
const LAST_UPDATED_KEY = 'recommendations:last_updated';
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';

function selectRecommendations(titles: string[]): string[] {
  return [...titles].sort(() => 0.5 - Math.random()).slice(0, 6);
}

async function fetchMovieTitles(request: NextRequest): Promise<string[]> {
  const url = new URL('/api/douban/categories', request.url);
  url.searchParams.set('kind', 'movie');
  url.searchParams.set('category', '热门');
  url.searchParams.set('type', '全部');
  url.searchParams.set('limit', '50');

  const response = await fetch(url, {
    headers: {
      cookie: request.headers.get('cookie') || '',
    },
  });
  if (!response.ok) {
    throw new Error(`Douban API returned ${response.status}`);
  }

  const data = (await response.json()) as {
    list?: Array<{ title?: unknown }>;
  };
  return Array.from(
    new Set(
      (data.list || [])
        .map((movie) => movie.title)
        .filter(
          (title): title is string => typeof title === 'string' && !!title
        )
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

    // localstorage/redis 不依賴 Upstash；直接使用已有 CDN 快取的豆瓣 API。
    if (storageType !== 'upstash') {
      const titles = await fetchMovieTitles(request);
      return NextResponse.json(
        { list: selectRecommendations(titles) },
        { headers: { 'Cache-Control': 'private, max-age=300' } }
      );
    }

    const client = getUpstashRedisClient();
    const [lastUpdatedValue, cachedValue] = await Promise.all([
      client.get(LAST_UPDATED_KEY),
      client.get(RECOMMENDATIONS_KEY),
    ]);
    const lastUpdated = Number(lastUpdatedValue) || 0;
    const cachedTitles =
      typeof cachedValue === 'string'
        ? cachedValue.split(',').filter(Boolean)
        : Array.isArray(cachedValue)
        ? cachedValue.filter(
            (title): title is string => typeof title === 'string'
          )
        : [];

    if (
      cachedTitles.length > 0 &&
      Date.now() - lastUpdated <= REFRESH_INTERVAL_MS
    ) {
      return NextResponse.json({
        list: selectRecommendations(cachedTitles),
      });
    }

    const titles = await fetchMovieTitles(request);
    await Promise.all([
      client.set(RECOMMENDATIONS_KEY, titles.join(',')),
      client.set(LAST_UPDATED_KEY, Date.now()),
    ]);
    return NextResponse.json({ list: selectRecommendations(titles) });
  } catch (error) {
    console.error('Failed to load recommendations:', error);
    return NextResponse.json({ list: [] });
  }
}
