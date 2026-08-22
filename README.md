# TradingView MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes TradingView market data —
quotes, technical analysis, historical candles, symbol search, a screener, news, and
community ideas — as tools an MCP client (e.g. Claude Code, Claude Desktop) can call.

It talks to TradingView's own (undocumented, reverse-engineered) endpoints: the
`data.tradingview.com` WebSocket feed for quotes/charts, and the `scanner`,
`symbol-search`, `news-headlines`, and `ideas` HTTP APIs. Because these are not a
published, versioned API, TradingView can change them without notice.

## Tools

| Tool | Description |
| --- | --- |
| `tv_health_check` | Diagnose setup: checks auth, the WebSocket quote feed, and the scanner/search/news/ideas HTTP endpoints. |
| `tv_get_quote` | Real-time quote (price, change, volume, bid/ask, market cap, P/E, ...) for one or more symbols. |
| `tv_get_technical_analysis` | TradingView's buy/sell/neutral rating (overall, moving averages, oscillators) plus raw indicator values. |
| `tv_get_historical_data` | Historical OHLCV candles for a symbol/interval. |
| `tv_search_symbols` | Search TradingView symbols by name/keyword. |
| `tv_screener` | Filter/sort/screen symbols in a market by scanner columns. |
| `tv_get_news` | Recent news headlines, optionally filtered to a symbol. |
| `tv_get_ideas` | Published TradingView community trading ideas for a symbol. |

Symbols use TradingView's `EXCHANGE:SYMBOL` format, e.g. `NASDAQ:AAPL`,
`BINANCE:BTCUSDT`, `FX:EURUSD`.

## Authentication

Most tools work without logging in, but TradingView limits unauthenticated access
(delayed data on some symbols, restricted premium data, lower rate limits). To use an
authenticated TradingView session, set:

```
TRADINGVIEW_SESSION_ID=...
TRADINGVIEW_SESSION_ID_SIGN=...
```

Get these from a logged-in browser session at tradingview.com: open DevTools →
Application/Storage → Cookies → `https://www.tradingview.com`, and copy the `sessionid`
and `sessionid_sign` cookie values. See `.env.example`.

Treat these like a password — anyone with them can act as your TradingView account.
Never commit real values.

## Setup

```bash
npm install
```

Set env vars (directly, or via a `.env` loaded by your shell/MCP client — this project
does not load `.env` itself):

```bash
export TRADINGVIEW_SESSION_ID=...
export TRADINGVIEW_SESSION_ID_SIGN=...
```

Run standalone (for a quick smoke test — it just waits for stdio input):

```bash
npm start
```

## Using it as an MCP server

Point an MCP client at `src/server.js`, passing your credentials through its `env`:

```json
{
  "mcpServers": {
    "tradingview": {
      "command": "node",
      "args": ["/path/to/this/repo/src/server.js"],
      "env": {
        "TRADINGVIEW_SESSION_ID": "...",
        "TRADINGVIEW_SESSION_ID_SIGN": "..."
      }
    }
  }
}
```

## Project layout

```
src/
  server.js                MCP server: registers the tools above
  tradingview/
    session.js              Auth-token retrieval from the session cookie
    wsClient.js              Low-level TradingView WebSocket framing/client
    quotes.js                 tv_get_quote (WebSocket quote session)
    chart.js                  tv_get_historical_data (WebSocket chart session)
    scanner.js                 tv_get_technical_analysis, tv_screener (scanner HTTP API)
    search.js                   tv_search_symbols (symbol-search HTTP API)
    news.js                      tv_get_news (news-headlines HTTP API)
    ideas.js                      tv_get_ideas (ideas HTTP API)
```

## Notes & limitations

- These are unofficial, reverse-engineered endpoints, not a public API — expect
  occasional breakage if TradingView changes them.
- `tv_screener` filter `operation` values follow TradingView's scanner syntax (e.g.
  `greater`, `egreater`, `less`, `eless`, `equal`, `in_range`) and `left`/column names
  follow TradingView's internal scanner field names (e.g. `close`, `volume`, `change`,
  `market_cap_basic`, `RSI`, `sector`).
- Historical data intervals: `1,3,5,15,30,45,60,120,180,240` (minutes) or `D`/`W`/`M`.
