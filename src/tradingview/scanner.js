import { getCookieHeader } from './session.js';

const TA_COLUMNS = [
  'Recommend.All',
  'Recommend.MA',
  'Recommend.Other',
  'RSI',
  'Stoch.K',
  'Stoch.D',
  'CCI20',
  'ADX',
  'AO',
  'Mom',
  'MACD.macd',
  'MACD.signal',
  'Stoch.RSI.K',
  'W%R',
  'UO',
  'EMA10',
  'SMA10',
  'EMA20',
  'SMA20',
  'EMA50',
  'SMA50',
  'EMA100',
  'SMA100',
  'EMA200',
  'SMA200',
  'close',
  'open',
  'high',
  'low',
  'volume',
  'change',
  'description',
  'exchange',
  'type',
];

function ratingLabel(value) {
  if (value === null || value === undefined) return 'NEUTRAL';
  if (value >= 0.5) return 'STRONG_BUY';
  if (value >= 0.1) return 'BUY';
  if (value <= -0.5) return 'STRONG_SELL';
  if (value <= -0.1) return 'SELL';
  return 'NEUTRAL';
}

async function scan(market, body) {
  const headers = { 'Content-Type': 'application/json' };
  const cookie = getCookieHeader();
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`https://scanner.tradingview.com/${market}/scan`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`TradingView scanner request failed (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function getTechnicalAnalysis({ symbol, market = 'america', interval }) {
  if (!symbol) throw new Error('A symbol is required.');
  const columns = interval ? TA_COLUMNS.map((c) => (c === 'description' || c === 'exchange' || c === 'type' ? c : `${c}|${interval}`)) : TA_COLUMNS;

  const data = await scan(market, {
    symbols: { tickers: [symbol] },
    columns,
  });

  const row = data?.data?.[0];
  if (!row) throw new Error(`No technical analysis data found for "${symbol}".`);

  const values = Object.fromEntries(TA_COLUMNS.map((name, i) => [name, row.d[i]]));

  return {
    symbol,
    description: values.description,
    exchange: values.exchange,
    type: values.type,
    price: values.close,
    change: values.change,
    summary: {
      overall: ratingLabel(values['Recommend.All']),
      movingAverages: ratingLabel(values['Recommend.MA']),
      oscillators: ratingLabel(values['Recommend.Other']),
    },
    oscillators: {
      RSI: values.RSI,
      'Stoch.K': values['Stoch.K'],
      'Stoch.D': values['Stoch.D'],
      CCI20: values.CCI20,
      ADX: values.ADX,
      AO: values.AO,
      Momentum: values.Mom,
      'MACD.macd': values['MACD.macd'],
      'MACD.signal': values['MACD.signal'],
      'Stoch.RSI.K': values['Stoch.RSI.K'],
      'Williams.%R': values['W%R'],
      UO: values.UO,
    },
    movingAverages: {
      EMA10: values.EMA10,
      SMA10: values.SMA10,
      EMA20: values.EMA20,
      SMA20: values.SMA20,
      EMA50: values.EMA50,
      SMA50: values.SMA50,
      EMA100: values.EMA100,
      SMA100: values.SMA100,
      EMA200: values.EMA200,
      SMA200: values.SMA200,
    },
  };
}

export async function runScreener({
  market = 'america',
  columns = ['name', 'close', 'change', 'volume', 'market_cap_basic'],
  filters = [],
  sortBy = 'market_cap_basic',
  sortOrder = 'desc',
  limit = 25,
}) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));

  const data = await scan(market, {
    filter: filters,
    options: { lang: 'en' },
    markets: [market],
    symbols: { query: { types: [] }, tickers: [] },
    columns,
    sort: { sortBy, sortOrder },
    range: [0, boundedLimit],
  });

  return {
    totalCount: data.totalCount,
    results: (data.data ?? []).map((row) => ({
      symbol: row.s,
      values: Object.fromEntries(columns.map((c, i) => [c, row.d[i]])),
    })),
  };
}
