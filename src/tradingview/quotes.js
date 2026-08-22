import { TVSocket, randomSessionId, withTimeout } from './wsClient.js';
import { getAuthToken, getCookieHeader } from './session.js';

const QUOTE_FIELDS = [
  'lp',
  'ch',
  'chp',
  'volume',
  'bid',
  'ask',
  'open_price',
  'high_price',
  'low_price',
  'prev_close_price',
  'description',
  'short_name',
  'exchange',
  'currency_code',
  'market_cap_basic',
  'earnings_per_share_basic_ttm',
  'price_earnings_ttm',
  'update_mode',
];

export async function getQuotes(symbols) {
  if (!symbols?.length) throw new Error('At least one symbol is required.');

  const authToken = await getAuthToken();
  const socket = new TVSocket({ cookie: getCookieHeader() });
  await socket.connect();

  const sessionId = randomSessionId('qs');
  const values = new Map(symbols.map((s) => [s, {}]));
  const errored = new Set();
  const completed = new Set();

  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const unsubscribe = socket.onMessage((msg) => {
    if (msg.m === 'qsd' && msg.p?.[0] === sessionId) {
      const { n, v, s } = msg.p[1];
      if (s === 'error') {
        errored.add(n);
      } else {
        values.set(n, { ...values.get(n), ...v });
      }
    } else if (msg.m === 'quote_completed' && msg.p?.[0] === sessionId) {
      completed.add(msg.p[1]);
      if (completed.size + errored.size >= symbols.length) resolveDone();
    }
  });

  try {
    socket.send('set_auth_token', [authToken]);
    socket.send('quote_create_session', [sessionId]);
    socket.send('quote_set_fields', [sessionId, ...QUOTE_FIELDS]);
    socket.send('quote_add_symbols', [sessionId, ...symbols]);

    await withTimeout(done, 8000, 'Timed out waiting for quote data from TradingView.');
  } finally {
    unsubscribe();
    socket.close();
  }

  return symbols.map((symbol) => {
    if (errored.has(symbol)) {
      return { symbol, error: 'Symbol not found or not accessible.' };
    }
    const v = values.get(symbol);
    return {
      symbol,
      name: v.short_name ?? v.description,
      exchange: v.exchange,
      currency: v.currency_code,
      price: v.lp,
      change: v.ch,
      changePercent: v.chp,
      open: v.open_price,
      high: v.high_price,
      low: v.low_price,
      previousClose: v.prev_close_price,
      bid: v.bid,
      ask: v.ask,
      volume: v.volume,
      marketCap: v.market_cap_basic,
      eps: v.earnings_per_share_basic_ttm,
      peRatio: v.price_earnings_ttm,
      updateMode: v.update_mode,
    };
  });
}
