import { TVSocket, randomSessionId, withTimeout } from './wsClient.js';
import { getAuthToken, getCookieHeader } from './session.js';

const VALID_INTERVALS = new Set([
  '1',
  '3',
  '5',
  '15',
  '30',
  '45',
  '60',
  '120',
  '180',
  '240',
  'D',
  'W',
  'M',
]);

export async function getHistoricalData({ symbol, interval = 'D', bars = 100 }) {
  if (!symbol) throw new Error('A symbol is required.');
  if (!VALID_INTERVALS.has(interval)) {
    throw new Error(`Invalid interval "${interval}". Valid values: ${[...VALID_INTERVALS].join(', ')}.`);
  }
  const barCount = Math.max(1, Math.min(5000, Math.trunc(bars)));

  const authToken = await getAuthToken();
  const socket = new TVSocket({ cookie: getCookieHeader() });
  await socket.connect();

  const chartSession = randomSessionId('cs');
  const symbolId = 'sds_sym_1';
  const seriesId = 'sds_1';
  const candles = new Map();
  let symbolError = null;

  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const unsubscribe = socket.onMessage((msg) => {
    if (msg.m === 'timescale_update' && msg.p?.[0] === chartSession) {
      const points = msg.p[1]?.[seriesId]?.s ?? [];
      for (const point of points) {
        const [time, open, high, low, close, volume] = point.v;
        candles.set(time, { time, open, high, low, close, volume });
      }
    } else if (msg.m === 'du' && msg.p?.[0] === chartSession) {
      const points = msg.p[1]?.[seriesId]?.s ?? [];
      for (const point of points) {
        const [time, open, high, low, close, volume] = point.v;
        candles.set(time, { time, open, high, low, close, volume });
      }
    } else if (msg.m === 'series_completed' && msg.p?.[0] === chartSession) {
      resolveDone();
    } else if (msg.m === 'symbol_error' && msg.p?.[0] === chartSession) {
      symbolError = `Symbol "${symbol}" not found.`;
      resolveDone();
    } else if (msg.m === 'series_error' && msg.p?.[0] === chartSession) {
      symbolError = `Failed to load series for "${symbol}".`;
      resolveDone();
    }
  });

  try {
    socket.send('set_auth_token', [authToken]);
    socket.send('chart_create_session', [chartSession, '']);
    socket.send('resolve_symbol', [
      chartSession,
      symbolId,
      `=${JSON.stringify({ symbol, adjustment: 'splits' })}`,
    ]);
    socket.send('create_series', [chartSession, seriesId, 's1', symbolId, interval, barCount, '']);

    await withTimeout(done, 12000, 'Timed out waiting for chart data from TradingView.');
  } finally {
    unsubscribe();
    socket.close();
  }

  if (symbolError) throw new Error(symbolError);

  return [...candles.values()]
    .sort((a, b) => a.time - b.time)
    .map((c) => ({ ...c, time: new Date(c.time * 1000).toISOString() }));
}
