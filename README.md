# Algomarket

Cross-venue prediction market analytics for **Polymarket**, **Kalshi**, and more — whale holdings, live large fills, arbitrage scanner, and market screener.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — configure API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data sources

### Prediction markets (integrated)

| Source | Auth | Coverage | Used in |
|--------|------|----------|---------|
| **Polymarket** (Gamma API) | None | Direct market data | Dashboard, screener, arbs |
| **Kalshi** (Trade API) | None | Direct market data | Dashboard, screener, arbs, live |
| **PolyRouter** | API key (free beta) | 7 platforms unified | `/api/markets/aggregate` |
| **SimpleFunctions** | Optional key | Kalshi + Polymarket scan/changes | Live feed, screener |
| **PredScope** | None | 510+ Polymarket markets | Screener |
| **Manifold** | None | Play-money markets | Screener |
| **Metaculus** | None | Academic forecasts | Screener |
| **Dome** | API key | Orderbooks (EOL Apr 2026) | Orderbook client |

### Cryptocurrency

| Source | Auth | Notes |
|--------|------|-------|
| **CoinPaprika** | None | Primary — 20k calls/month, no key |
| **CoinGecko** | Optional key | Fallback if CoinPaprika empty |
| **CoinMarketCap** | API key | Optional secondary source |

### Macro & Hyperliquid

| Source | Auth | Notes |
|--------|------|-------|
| **FRED** | Free API key | GDP, unemployment, CPI, rates |
| **GoldRush** | API key | Hyperliquid ecosystem data |

### Local whale data

Whale holdings and trade history are read from SQLite (`whale_data.db`). The app auto-detects the database at:

1. `WHALE_DB_PATH` (if set in `.env.local`)
2. `$WHALE_SCRAPER_DIR/whale_data.db` (default scraper dir: `~/Desktop/PolymarketAnalysis`)
3. `./whale_data.db` or `./public/whale_data.db`

```bash
# .env.local
WHALE_DB_PATH=/path/to/whale_data.db
WHALE_SCRAPER_DIR=~/Desktop/PolymarketAnalysis
```

Health check: `GET /api/health`

Start background scrapers:

```bash
npm run scrape:ensure    # Kalshi live + batch if stale
npm run scrape           # Polymarket whale holdings
npm run scrape:live      # Kalshi anonymous large fills
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Whale holdings vs. market odds, top movers, crypto strip |
| `/arbs` | Cross-venue arbitrage scanner with filters and alerts |
| `/screener` | Filter markets by prob, volume, days (Poly, Kalshi, Manifold, Metaculus) |
| `/live` | Large fills feed + cross-venue market changes |
| `/traders` | Whale leaderboard with win rate, smart-money score, follow |
| `/trader/[wallet]` | Trader profile (redirects to profile view) |
| `/profile` | Wallet positions, P&L chart, activity |
| `/market/[id]` | Market detail — risk rating, Kelly calc, correlation, whale positions |
| `/markets` | Exposure by contract |
| `/alerts` | In-app alerts for price, whale, and arb events |
| `/tools/kelly` | Kelly criterion position sizing calculator |
| `/tools/portfolio` | Paper trading portfolio tracker |
| `/workspace/[id]` | Shareable market analysis workspaces |

## Features

- **Risk ratings (A–F)** on market detail pages from liquidity, volatility, and timeline
- **Kelly calculator** for optimal bet sizing with fractional Kelly
- **Event correlation** — related markets by event, sector, and inverse pairs
- **Smart money score** on trader leaderboard (Elite / Strong / Average / Weak)
- **Follow traders** and **save alerts** (persisted in browser via Zustand)
- **Shareable workspaces** — copy a link to share your market watchlist
- **Paper trading** with open/close positions and P&L tracking
- **Health check** at `GET /api/health` for deployment monitoring

## Deployment (Render)

Set environment variables on Render:

```bash
WHALE_DB_PATH=/data/whale_data.db   # mount persistent disk
WHALE_SCRAPER_DIR=/data
ALGOMARKET_API_KEY=your-secret-key
POLYROUTER_API_KEY=optional
```

Build command: `npm install && npm run build`  
Start command: `npm start`  
Health check path: `/api/health`

Mount a persistent disk for `whale_data.db` or run scrapers separately and sync the DB file.

## API routes

### Public

- `GET /api/dashboard` — whale holdings panel
- `GET /api/market_screener` — filtered market catalog
- `GET /api/arbitrage` — cross-venue arb pairs
- `GET /api/live_whales` — large fills feed
- `GET /api/markets/aggregate` — unified markets from all sources
- `GET /api/market_changes?since=1h` — SimpleFunctions change feed
- `GET /api/crypto` — crypto ticker overview (CoinPaprika)
- `GET /api/health` — DB connectivity and trader count (for Render health checks)
- `GET /api/macro` — FRED macro series (requires `FRED_API_KEY`)

### Developer (auth via `x-api-key` or `?api_key=`)

- `GET /api/arbs` — top cross-venue arbs with net ROI
- `GET /api/whales` — whale leaderboard

Default dev key: `algomarket-dev-key` (override with `ALGOMARKET_API_KEY`).

## API client structure

```
src/lib/api/
├── clients/          # One module per external API
├── types/            # Shared TypeScript types
├── aggregator.ts     # Multi-source fetch with graceful degradation
├── http.ts           # Rate-limited fetch wrapper
└── index.ts          # Barrel exports
```

## Environment variables

Copy `.env.example` to `.env.local`. Priority keys to configure:

```bash
POLYROUTER_API_KEY=       # Free at polyrouter.io — unlocks 7-platform unified API
SIMPLEFUNCTIONS_API_KEY=  # Optional — public endpoints work without key
FRED_API_KEY=             # Free at fred.stlouisfed.org — macro dashboard
COINGECKO_API_KEY=        # Optional — CoinPaprika works without any key
```

## Testing

```bash
npm test          # Run API client unit tests
npm run test:watch
```

Tests include mock responses and verify graceful degradation when APIs fail.

## Stack

Next.js 14 · React Query · Zustand · better-sqlite3 · Recharts · Framer Motion · Vitest
