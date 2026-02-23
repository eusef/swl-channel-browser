# SWL Channel Browser

A web-based shortwave radio browser that shows you what's on the air right now. Connects to SDRplay hardware via SDRconnect for live tuning, audio streaming, and signal visualization.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

## What It Does

- **On Now / Coming Up** - Browse thousands of shortwave broadcasts from the EiBi schedule database, filtered by current UTC time
- **Live Audio** - Tune and listen to broadcasts through your SDRplay receiver with AM, SSB, CW, FM demodulation
- **Spectrum & Waterfall** - Real-time spectrum display and scrolling waterfall spectrogram
- **Propagation Data** - Solar flux and geomagnetic conditions from NOAA, with per-band quality badges
- **Favorites & Logging** - Save stations, add notes, log receptions with signal metrics, export as CSV
- **PWA** - Installable on mobile and desktop, responsive layout with dark theme

## Requirements

- [SDRplay](https://www.sdrplay.com/) receiver (RSP1A, RSP1B, RSPdx, RSPdx-R2, RSPduo, etc.)
- [SDRconnect](https://www.sdrplay.com/sdrconnect/) running with WebSocket API enabled
- Node.js 18+

## Quick Start

```bash
git clone https://github.com/eusef/swl-channel-browser.git
cd swl-channel-browser
npm install
```

Create a `.env` file:

```
PORT=3000
EIBI_CSV_URL=http://www.eibispace.de/dx/sked-b25.csv
EIBI_REFRESH_HOURS=168
SDRCONNECT_HOST=127.0.0.1
SDRCONNECT_PORT=5454
```

Run in development mode:

```bash
npm run dev
```

Build and run for production:

```bash
npm run build
npm start
```

Open `http://localhost:3000` in your browser.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `EIBI_CSV_URL` | EiBi B25 schedule | URL for the EiBi CSV schedule file |
| `EIBI_REFRESH_HOURS` | `168` | Hours between schedule refreshes (168 = weekly) |
| `SDRCONNECT_HOST` | `127.0.0.1` | SDRconnect host address |
| `SDRCONNECT_PORT` | `5454` | SDRconnect WebSocket port |

Additional settings (demod mode, antenna port, theme, time format) are configurable in the app's Settings page.

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** Express, TypeScript
- **Audio:** Web Audio API (AudioWorklet + ScriptProcessor fallback)
- **Data:** EiBi shortwave schedules, NOAA Space Weather Prediction Center

## Data Attribution

- Station schedules from [EiBi Short-wave Schedules](http://www.eibispace.de/) by Eike Bierwirth
- Propagation data from [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/)

## License

MIT - see [LICENSE](LICENSE)
