import WebSocket from 'ws';

const WS_URL = 'wss://data.tradingview.com/socket.io/websocket?from=chart%2F';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function frame(msg) {
  return `~m~${msg.length}~m~${msg}`;
}

function parseFrames(raw) {
  const frames = [];
  const re = /~m~(\d+)~m~/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    const len = parseInt(match[1], 10);
    const start = match.index + match[0].length;
    frames.push(raw.slice(start, start + len));
    re.lastIndex = start + len;
  }
  return frames;
}

export class TVSocket {
  constructor({ cookie } = {}) {
    this.cookie = cookie;
    this.ws = null;
    this.listeners = new Set();
    this.readyPromise = null;
  }

  connect() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve, reject) => {
      const headers = { Origin: 'https://www.tradingview.com', 'User-Agent': USER_AGENT };
      if (this.cookie) headers.Cookie = this.cookie;

      this.ws = new WebSocket(WS_URL, { headers });
      this.ws.on('open', () => resolve());
      this.ws.on('error', (err) => reject(err));
      this.ws.on('message', (data) => this._handleMessage(data.toString()));
      this.ws.on('close', () => {
        this.readyPromise = null;
      });
    });
    return this.readyPromise;
  }

  _handleMessage(raw) {
    for (const f of parseFrames(raw)) {
      if (f.startsWith('~h~')) {
        this.ws.send(frame(f));
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(f);
      } catch {
        continue;
      }
      for (const listener of this.listeners) listener(parsed);
    }
  }

  send(method, params) {
    this.ws.send(frame(JSON.stringify({ m: method, p: params })));
  }

  onMessage(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // socket already closed
    }
  }
}

export function randomSessionId(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}_${s}`;
}

export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message || `Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
