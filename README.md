# Polymarket Temperature Bet Tracker

Track daily temperature prediction markets on Polymarket and paper-trade them using live weather data from the same resolution sources the bets settle on.

## What This App Does

Polymarket lists daily bets on the highest temperature in cities around the world (e.g., "Highest temperature in Ben Gurion, Israel on March 16"). Each bet has multiple options for temperature ranges, and each option has a YES/NO price.

This app:

1. **Pulls all active temperature bets** from Polymarket in real time (every 5 seconds).
2. **Fetches live weather data** for each city from Open-Meteo (every 30 seconds), tracking hourly temperatures throughout the day.
3. **Detects when the daily peak has passed** by watching for observed cooling -- 2+ consecutive hours of declining recorded temperatures after the peak. This tells you the high for the day is likely locked in.
4. **Cross-checks the resolution website** (Weather Underground, etc.) to confirm whether the reading is "Observed" or still a "Forecast."
5. **Lets you paper-trade** with a virtual $1,000 balance, tracked in a database.

## Two Accounts

The app has two separate trading modes, each on its own page:

### Normal Temp (`/temp`)

For manual trading after the temperature has been confirmed.

- **Ready to Trade** tab -- Only shows bets where observed cooling has been confirmed (the high is locked in). This is when you know the correct answer and can trade accordingly.
- **Monitoring** tab -- Shows bets still in the forecast or heating phase (not ready yet).
- **Saved** tab -- Bets you've bookmarked.
- **Paper Trades** tab -- Your open and closed trades with live BID prices and P&L.

### Micro-Trades (`/micro`)

For automated fast-reaction trading on new bets.

- At **00:00 UTC** every day, Polymarket lists new temperature bets for the next day. When auto-trade is enabled, the app polls every 2 seconds around midnight and automatically buys every YES and NO option priced at 3 cents or less ($25 per position), as long as the bet has fewer than 9 options.
- **Active Positions** tab -- Shows the bet cards for events you hold positions in.
- **Upcoming** tab -- Future bets arriving in the next 48 hours.
- **History** tab -- Closed trades, auto-trade toggle, and midnight countdown.

## How to Run

You need **Node.js v18+** installed.

```sh
git clone <repo-url>
cd polymarket-bet-watch
npm install
npm run dev
```

Opens at `http://localhost:8080`. The `.env` file with Supabase credentials is already included.

### Other Commands

| Command | What it does |
|---------|-------------|
| `npm run build` | Production build (output in `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run tests |
| `npm run lint` | Check code with ESLint |

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- TanStack React Query (data polling)
- Supabase (database + edge functions)
- Polymarket Gamma API
- Open-Meteo weather API

## How It Works Under the Hood

The frontend polls three Supabase Edge Functions:

- **polymarket-proxy** -- Forwards requests to the Polymarket Gamma API (avoids CORS issues).
- **weather-data** -- Fetches hourly temperatures from Open-Meteo for each city. Computes `observedCoolingConfirmed` (true when 2+ consecutive recorded hours show declining temps after the peak).
- **resolution-proxy** -- Fetches the actual resolution website (e.g., Weather Underground) for a bet and scrapes whether the data is marked as "Observed."

On top of that, a dedicated `useMarketPrices` hook polls the current YES/NO prices for any markets you hold positions in every 5 seconds, so the BID and live P&L stay up to date.
