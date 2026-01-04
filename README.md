# ELCARO OS

**Institutional Prediction Market Terminal with Live Polymarket Data**

![ELCARO OS](https://img.shields.io/badge/ELCARO-OS-cyan?style=for-the-badge)
![Live Data](https://img.shields.io/badge/Data-LIVE-green?style=for-the-badge)
![Polymarket](https://img.shields.io/badge/Polymarket-API-purple?style=for-the-badge)

## Features

- 🐋 **Whale Radar** - Real-time detection of large trades
- 📊 **Live Order Book** - Bid/ask depth visualization
- 📈 **Signal Feed** - AI-generated trading signals
- 🎯 **ELCARO Score** - Aggregate market sentiment (0-100)

## Live Data Sources

| API | Endpoint | Refresh |
|-----|----------|---------|
| Gamma API | Markets, Volume, Liquidity | 30s |
| CLOB API | Order Book, Trades | 5s |

## Quick Start

```bash
# Install
npm install

# Development (with CORS proxy)
npm run dev

# Build for production
npm run build
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/elcaro-os)

## Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_USERNAME/elcaro-os)

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Polymarket Gamma & CLOB APIs

## Architecture

```
┌─────────────────────────────────────┐
│           ELCARO OS                 │
├─────────────────────────────────────┤
│  Whale Radar │ Order Book │ Signals │
├──────────────┴────────────┴─────────┤
│         Polymarket APIs             │
│    (Gamma + CLOB - Live Data)       │
└─────────────────────────────────────┘
```

## License

MIT
