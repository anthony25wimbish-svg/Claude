#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { hasCredentials } from './tradingview/session.js';
import { getQuotes } from './tradingview/quotes.js';
import { getHistoricalData } from './tradingview/chart.js';
import { getTechnicalAnalysis, runScreener } from './tradingview/scanner.js';
import { searchSymbols } from './tradingview/search.js';
import { getNews } from './tradingview/news.js';
import { getIdeas } from './tradingview/ideas.js';

const server = new McpServer({
  name: 'tradingview-mcp',
  version: '1.0.0',
});

function jsonResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err) {
  return {
    content: [{ type: 'text', text: `Error: ${err.message}` }],
    isError: true,
  };
}

server.registerTool(
  'tv_get_quote',
  {
    title: 'Get TradingView quote',
    description:
      'Get real-time quote data (price, change, volume, bid/ask, market cap, P/E, etc.) for one or more ' +
      'TradingView symbols, e.g. "NASDAQ:AAPL", "BINANCE:BTCUSDT", "FX:EURUSD".',
    inputSchema: {
      symbols: z.array(z.string()).min(1).max(50).describe('Ticker symbols in EXCHANGE:SYMBOL format.'),
    },
  },
  async ({ symbols }) => {
    try {
      return jsonResult(await getQuotes(symbols));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'tv_get_technical_analysis',
  {
    title: 'Get TradingView technical analysis',
    description:
      'Get TradingView\'s technical analysis rating (overall/moving averages/oscillators summary, plus raw ' +
      'oscillator and moving-average values) for a symbol.',
    inputSchema: {
      symbol: z.string().describe('Ticker symbol in EXCHANGE:SYMBOL format, e.g. "NASDAQ:AAPL".'),
      market: z
        .string()
        .default('america')
        .describe('TradingView market/screener the symbol belongs to (e.g. america, crypto, forex, cfd).'),
      interval: z
        .enum(['1', '5', '15', '30', '60', '120', '240', '1D', '1W', '1M'])
        .optional()
        .describe('Optional timeframe for the analysis. Defaults to TradingView\'s daily rating.'),
    },
  },
  async ({ symbol, market, interval }) => {
    try {
      return jsonResult(await getTechnicalAnalysis({ symbol, market, interval }));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'tv_get_historical_data',
  {
    title: 'Get TradingView historical OHLCV data',
    description: 'Get historical OHLCV (open/high/low/close/volume) candle data for a symbol.',
    inputSchema: {
      symbol: z.string().describe('Ticker symbol in EXCHANGE:SYMBOL format, e.g. "NASDAQ:AAPL".'),
      interval: z
        .enum(['1', '3', '5', '15', '30', '45', '60', '120', '180', '240', 'D', 'W', 'M'])
        .default('D')
        .describe('Candle interval/resolution. Minutes as numbers, or D/W/M for day/week/month.'),
      bars: z.number().int().min(1).max(5000).default(100).describe('Number of most recent bars to return.'),
    },
  },
  async ({ symbol, interval, bars }) => {
    try {
      return jsonResult(await getHistoricalData({ symbol, interval, bars }));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'tv_search_symbols',
  {
    title: 'Search TradingView symbols',
    description: 'Search for TradingView ticker symbols by name or keyword.',
    inputSchema: {
      query: z.string().describe('Search text, e.g. "apple" or "AAPL".'),
      type: z
        .enum(['stock', 'fund', 'dr', 'bond', 'structured', 'futures', 'index', 'forex', 'crypto', 'economic'])
        .optional()
        .describe('Restrict results to a symbol type.'),
      exchange: z.string().optional().describe('Restrict results to a specific exchange, e.g. "NASDAQ".'),
      limit: z.number().int().min(1).max(50).default(20),
    },
  },
  async ({ query, type, exchange, limit }) => {
    try {
      return jsonResult(await searchSymbols({ query, type, exchange, limit }));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'tv_screener',
  {
    title: 'Run a TradingView screener query',
    description:
      'Screen symbols in a TradingView market by column filters, e.g. find US stocks with market cap over ' +
      '$1B sorted by volume. Column names follow TradingView\'s scanner field names ' +
      '(e.g. close, volume, change, market_cap_basic, RSI, sector).',
    inputSchema: {
      market: z
        .string()
        .default('america')
        .describe('Market to screen (e.g. america, crypto, forex, cfd, india).'),
      columns: z
        .array(z.string())
        .default(['name', 'close', 'change', 'volume', 'market_cap_basic'])
        .describe('Scanner columns to return for each result.'),
      filters: z
        .array(
          z.object({
            left: z.string().describe('Column name to filter on.'),
            operation: z
              .string()
              .describe('Comparison operator, e.g. greater, egreater, less, eless, equal, in_range.'),
            right: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]),
          }),
        )
        .default([])
        .describe('Filter conditions, ANDed together.'),
      sortBy: z.string().default('market_cap_basic').describe('Column to sort results by.'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      limit: z.number().int().min(1).max(100).default(25),
    },
  },
  async ({ market, columns, filters, sortBy, sortOrder, limit }) => {
    try {
      return jsonResult(await runScreener({ market, columns, filters, sortBy, sortOrder, limit }));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'tv_get_news',
  {
    title: 'Get TradingView news',
    description: 'Get recent news headlines, optionally filtered to a specific symbol.',
    inputSchema: {
      symbol: z.string().optional().describe('Ticker symbol in EXCHANGE:SYMBOL format. Omit for general market news.'),
      limit: z.number().int().min(1).max(50).default(10),
    },
  },
  async ({ symbol, limit }) => {
    try {
      return jsonResult(await getNews({ symbol, limit }));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'tv_get_ideas',
  {
    title: 'Get TradingView community ideas',
    description: 'Get published TradingView community trading ideas for a symbol.',
    inputSchema: {
      symbol: z.string().describe('Symbol without exchange prefix, e.g. "AAPL".'),
      sort: z.enum(['recent', 'popular']).default('recent'),
      limit: z.number().int().min(1).max(50).default(10),
    },
  },
  async ({ symbol, sort, limit }) => {
    try {
      return jsonResult(await getIdeas({ symbol, sort, limit }));
    } catch (err) {
      return errorResult(err);
    }
  },
);

async function main() {
  if (!hasCredentials()) {
    console.error(
      '[tradingview-mcp] Warning: TRADINGVIEW_SESSION_ID is not set. Running unauthenticated — ' +
        'some data (delayed quotes, restricted symbols) may be limited. See README.md for how to obtain ' +
        'session cookies from a logged-in browser.',
    );
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[tradingview-mcp] Fatal error:', err);
  process.exit(1);
});
