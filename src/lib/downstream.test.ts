import { searchFromApi } from '@/lib/downstream';

jest.mock('@/lib/config', () => ({
  API_CONFIG: {
    search: {
      path: '?ac=videolist&wd=',
      pagePath: '?ac=videolist&wd={query}&pg={page}',
      headers: {
        Accept: 'application/json',
      },
    },
  },
  getConfig: jest.fn().mockResolvedValue({
    SiteConfig: {
      SearchDownstreamMaxPage: 1,
    },
  }),
}));

describe('downstream search', () => {
  it('sends a Simplified Chinese query to the source', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pagecount: 1,
        list: [
          {
            vod_id: '1',
            vod_name: '庆余年',
            vod_pic: 'https://example.com/poster.jpg',
          },
        ],
      }),
    });
    global.fetch = fetchMock;

    const results = await searchFromApi(
      {
        key: 'test',
        name: 'Test source',
        api: 'https://example.com/api.php',
      },
      '慶餘年'
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api.php?ac=videolist&wd=%E5%BA%86%E4%BD%99%E5%B9%B4',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
        },
      })
    );
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('庆余年');
  });
});
