export async function getNews({ symbol, limit = 10 }) {
  const params = new URLSearchParams({ category: 'stock', client: 'web', lang: 'en' });
  if (symbol) params.set('symbol', symbol);

  const res = await fetch(`https://news-headlines.tradingview.com/v2/headlines?${params}`, {
    headers: { Origin: 'https://www.tradingview.com' },
  });
  if (!res.ok) {
    throw new Error(`News request failed (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));

  return (data.items ?? []).slice(0, boundedLimit).map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    provider: item.provider,
    published: item.published ? new Date(item.published * 1000).toISOString() : null,
    url: item.link || (item.storyPath ? `https://www.tradingview.com${item.storyPath}` : null),
    relatedSymbols: (item.relatedSymbols ?? []).map((r) => r.symbol),
  }));
}
