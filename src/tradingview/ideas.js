import { getCookieHeader } from './session.js';

export async function getIdeas({ symbol, limit = 10, sort = 'recent' }) {
  if (!symbol) throw new Error('A symbol is required.');

  const params = new URLSearchParams({ symbol, sort });
  const headers = { Origin: 'https://www.tradingview.com' };
  const cookie = getCookieHeader();
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`https://www.tradingview.com/api/v1/ideas/?${params}`, { headers });
  if (!res.ok) {
    throw new Error(`Ideas request failed (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));

  return (data.results ?? []).slice(0, boundedLimit).map((idea) => ({
    id: idea.id,
    title: idea.name,
    description: idea.description,
    author: idea.user?.username,
    direction: idea.symbol?.direction === 1 ? 'LONG' : idea.symbol?.direction === 2 ? 'SHORT' : 'NEUTRAL',
    createdAt: idea.created_at,
    commentsCount: idea.comments_count,
    viewsCount: idea.views_count,
    url: idea.chart_url,
  }));
}
