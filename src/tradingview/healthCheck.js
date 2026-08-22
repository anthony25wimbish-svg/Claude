import { TVSocket, randomSessionId, withTimeout } from './wsClient.js';
import { getAuthToken, getCookieHeader, hasCredentials } from './session.js';

async function checkAuth() {
  if (!hasCredentials()) {
    return { status: 'skipped', detail: 'No TRADINGVIEW_SESSION_ID set — running unauthenticated.' };
  }
  try {
    await getAuthToken({ forceRefresh: true });
    return { status: 'ok', detail: 'Session cookie accepted, auth token obtained.' };
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}

async function checkWebsocket() {
  const socket = new TVSocket({ cookie: getCookieHeader() });
  try {
    await withTimeout(socket.connect(), 6000, 'WebSocket connection timed out.');

    const sessionId = randomSessionId('qs');
    let resolveDone;
    const done = new Promise((resolve) => {
      resolveDone = resolve;
    });
    const unsubscribe = socket.onMessage((msg) => {
      if (msg.m === 'quote_completed' && msg.p?.[0] === sessionId) resolveDone();
      if (msg.m === 'qsd' && msg.p?.[0] === sessionId && msg.p[1]?.s === 'error') resolveDone();
    });

    socket.send('set_auth_token', ['unauthorized_user_token']);
    socket.send('quote_create_session', [sessionId]);
    socket.send('quote_set_fields', [sessionId, 'lp']);
    socket.send('quote_add_symbols', [sessionId, 'NASDAQ:AAPL']);

    await withTimeout(done, 6000, 'Timed out waiting for a quote reply.');
    unsubscribe();
    return { status: 'ok', detail: 'Connected and received live quote data.' };
  } catch (err) {
    return { status: 'error', detail: err.message };
  } finally {
    socket.close();
  }
}

async function checkHttpEndpoint(name, url, init) {
  try {
    const res = await withTimeout(fetch(url, init), 8000, `${name} request timed out.`);
    if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}` };
    await res.json();
    return { status: 'ok', detail: `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}

export async function runHealthCheck() {
  const [auth, websocket, scanner, search, news, ideas] = await Promise.all([
    checkAuth(),
    checkWebsocket(),
    checkHttpEndpoint('scanner', 'https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: { tickers: ['NASDAQ:AAPL'] }, columns: ['close'] }),
    }),
    checkHttpEndpoint(
      'search',
      'https://symbol-search.tradingview.com/symbol_search/v3/?text=AAPL&hl=1&lang=en&domain=production',
      { headers: { Origin: 'https://www.tradingview.com' } },
    ),
    checkHttpEndpoint(
      'news',
      'https://news-headlines.tradingview.com/v2/headlines?category=stock&client=web&lang=en&symbol=NASDAQ:AAPL',
      { headers: { Origin: 'https://www.tradingview.com' } },
    ),
    checkHttpEndpoint('ideas', 'https://www.tradingview.com/api/v1/ideas/?symbol=AAPL&sort=recent', {
      headers: { Origin: 'https://www.tradingview.com' },
    }),
  ]);

  const checks = { auth, websocket, scanner, search, news, ideas };
  const ok = Object.values(checks).every((c) => c.status !== 'error');

  return {
    overall: ok ? 'ok' : 'degraded',
    authenticated: hasCredentials(),
    checks,
  };
}
