const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const TOKEN_TTL_MS = 10 * 60 * 1000;

let cachedToken = null;
let cachedAt = 0;

function sessionCookie() {
  const sessionId = process.env.TRADINGVIEW_SESSION_ID;
  const sessionSign = process.env.TRADINGVIEW_SESSION_ID_SIGN;
  if (!sessionId) return null;
  return sessionSign
    ? `sessionid=${sessionId}; sessionid_sign=${sessionSign}`
    : `sessionid=${sessionId}`;
}

export function hasCredentials() {
  return Boolean(process.env.TRADINGVIEW_SESSION_ID);
}

export function getCookieHeader() {
  return sessionCookie();
}

export async function getAuthToken({ forceRefresh = false } = {}) {
  const cookie = sessionCookie();
  if (!cookie) return 'unauthorized_user_token';

  if (!forceRefresh && cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const res = await fetch('https://www.tradingview.com/', {
    headers: { cookie, 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Failed to reach TradingView while authenticating (HTTP ${res.status}).`);
  }
  const html = await res.text();
  const match = html.match(/"auth_token":"(.*?)"/);
  if (!match || match[1] === 'unauthorized_user_token') {
    throw new Error(
      'Could not obtain an authenticated TradingView session. TRADINGVIEW_SESSION_ID is likely ' +
        'missing, expired, or invalid — copy fresh sessionid / sessionid_sign cookie values from ' +
        'a logged-in tradingview.com browser tab.',
    );
  }
  cachedToken = match[1];
  cachedAt = Date.now();
  return cachedToken;
}
