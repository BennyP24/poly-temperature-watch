<<<<<<< HEAD
# Polymarket Temperature Bet Tracker

A real-time dashboard for tracking and paper-trading Polymarket daily temperature prediction markets. Combines live weather data with market prices to identify trading opportunities based on observed temperature cooling patterns.

## Features

- **Two dedicated accounts**:
  - **Normal Temp** (`/temp`) -- Paper trade temperature bets after observed cooling is confirmed from the resolution source
  - **Micro-Trades** (`/micro`) -- Auto-buy YES and NO positions at 3 cents or less when new bets go live at 00:00 UTC
- **Real-time data polling** -- Polymarket prices every 5s, weather every 30s, resolution source every 60s
- **Observed cooling detection** -- Only marks a bet as ready to trade after 2+ consecutive hours of declining recorded temperatures past the daily peak
- **Resolution source verification** -- Scrapes Weather Underground and other resolution websites to confirm "Observed" vs "Forecast" status
- **Real-time BID tracking** -- Dedicated fast polling for markets you hold positions in
- **Midnight boost mode** -- Aggressive 2s polling around 00:00 UTC to catch new bets the instant they appear
- **Session export/import** -- Download and restore your paper trading sessions as JSON
- **Signal indicators** -- Color-coded badges: Forecast (blue), Live Heating (orange), Observed Cooling (green), Resolved (gray)
- **Hourly OBS/FCST tags** -- Every hourly temperature reading is labeled as Observed or Forecast

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui (Radix), Lucide icons
- **Data**: TanStack React Query
- **Backend**: Supabase (Postgres + Edge Functions)
- **APIs**: Polymarket Gamma API, Open-Meteo, resolution source websites

## Getting Started

### Prerequisites

- Node.js v18+ and npm

### Setup
=======
**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:
>>>>>>> 71ce8f6fbc18f645123df3f0141b76f8f5b385f2

```sh
# Clone the repo
git clone <repo-url>
cd polymarket-bet-watch

# Install dependencies
npm install

# Create .env with your Supabase credentials
# (already included if you cloned the full project)
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Start the dev server
npm run dev
```

The app runs at `http://localhost:8080`.

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests (Vitest) |
| `npm run lint` | Run ESLint |

## Architecture

```
src/
├── pages/
│   ├── Landing.tsx          # Account selector (/ route)
│   ├── TempAccount.tsx      # Normal temp trading (/temp)
│   ├── MicroAccount.tsx     # Micro-trades (/micro)
│   └── NotFound.tsx
├── hooks/
│   ├── usePolymarketData.ts # Polymarket event polling (5s)
│   ├── useWeatherData.ts    # Open-Meteo weather polling (30s)
│   ├── useResolutionData.ts # Resolution source scraping (60s)
│   ├── useMarketPrices.ts   # Real-time BID for open positions (5s)
│   ├── useMicroAutoTrade.ts # Auto-buy YES/NO ≤3¢, $25 each
│   ├── useMidnightBoost.ts  # 00:00 UTC detection, 2s boost polling
│   ├── usePaperTrading.ts   # Paper trade state (Supabase)
│   └── useSavedBets.ts      # Bookmarked bets (localStorage)
├── components/
│   ├── TemperatureBetCard.tsx  # Main bet card with signals
│   ├── SignalBadge.tsx         # Status indicators
│   ├── PaperTradesSummary.tsx  # Paper trades with real-time BID
│   ├── MicroTradesSummary.tsx  # Micro trades with countdown
│   ├── PortfolioHeader.tsx     # Balance, P&L, record
│   ├── StatusBar.tsx           # Active bets, refresh time
│   └── ClockDisplay.tsx        # Live timezone clocks
├── lib/
│   └── polymarket.ts        # Gamma API fetching & event parsing
└── integrations/
    └── supabase/             # Supabase client & DB types

supabase/functions/
├── polymarket-proxy/    # CORS proxy to Gamma API
├── weather-data/        # Open-Meteo with observed cooling logic
└── resolution-proxy/    # Resolution website scraping
```

<<<<<<< HEAD
## Supabase Edge Functions

The app relies on three Supabase Edge Functions:

- **polymarket-proxy** -- Generic CORS proxy to the Polymarket Gamma API
- **weather-data** -- Fetches Open-Meteo weather data with observed cooling detection (`observedCoolingConfirmed`)
- **resolution-proxy** -- Scrapes the bet's resolution source URL (Weather Underground, etc.) to extract observed high temperature and confirmation status

## Deployment

Build for production:

```sh
npm run build
```

Deploy the `dist/` folder to any static hosting provider (Vercel, Netlify, Cloudflare Pages, etc.). Make sure the Supabase Edge Functions are deployed to your Supabase project.
=======
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
>>>>>>> 71ce8f6fbc18f645123df3f0141b76f8f5b385f2
