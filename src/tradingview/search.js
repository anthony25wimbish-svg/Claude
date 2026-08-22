export async function searchSymbols({ query, type, exchange, limit = 20 }) {
  if (!query) throw new Error('A search query is required.');

  const params = new URLSearchParams({
    text: query,
    hl: '1',
    lang: 'en',
    domain: 'production',
  });
  if (type) params.set('type', type);
  if (exchange) params.set('exchange', exchange);

  const res = await fetch(`https://symbol-search.tradingview.com/symbol_search/v3/?${params}`, {
    headers: { Origin: 'https://www.tradingview.com' },
  });
  if (!res.ok) {
    throw new Error(`Symbol search failed (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));

  return (data.symbols ?? []).slice(0, boundedLimit).map((s) => ({
    symbol: s.symbol.replace(/<\/?em>/g, ''),
    description: s.description?.replace(/<\/?em>/g, ''),
    exchange: s.exchange,
    type: s.type,
    currency: s.currency_code,
    country: s.country,
  }));
}
