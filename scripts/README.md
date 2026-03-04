# SDRconnect WebSocket Property Test

Tests every known SDRconnect property for readability and writability over WebSocket. Produces a console report and a JSON file (`sdr-property-report.json` in the project root) showing which properties work, which are read-only, and which are unresponsive.

## Prerequisites

1. **Node.js** (v18+)
2. **npm dependencies installed** - from the `swl-channel-browser` project root:
   ```bash
   npm install
   ```
3. **A running SDRconnect instance** - either the GUI app or a headless instance. The script connects through the app's WebSocket proxy, so the dev server must also be running:
   ```bash
   npm run dev
   ```

## Usage

From the `swl-channel-browser` project root:

```bash
# Using the npm script alias (connects to ws://localhost:3000/ws/sdr)
npm run test:sdr

# Or directly with tsx
npx tsx scripts/sdr-property-test.ts

# Connect to a remote instance (e.g. headless SDRconnect on a Raspberry Pi)
npx tsx scripts/sdr-property-test.ts ws://pi-host:3000/ws/sdr
```

The default WebSocket URL is `ws://localhost:3000/ws/sdr`. Pass a different URL as the first argument to override it.

## What It Does

The script runs three test phases on each property:

1. **Read** - sends `get_property` and waits up to 3s for a response. Also captures properties sent spontaneously on connect.
2. **Write** (readable properties only) - sends `set_property` with a safe test value, then reads back. Restores the original value afterward.
3. **Blind write** (unreadable properties only) - sends `set_property` and checks whether the property becomes readable afterward.

## Output

The console report groups results by category (Tuning, Gain, Audio, etc.) and flags:

- **Confirmed writable** properties safe to implement in the UI
- **Feature request candidates** - properties that should be writable but aren't
- **Blind write discoveries** - previously unreadable properties that responded after a write

A full JSON report is saved to `sdr-property-report.json` in the project root.

## Timeouts

| Setting | Default | Purpose |
|---------|---------|---------|
| `CONNECT_TIMEOUT_MS` | 8000ms | Max wait for WebSocket connection |
| `GET_TIMEOUT_MS` | 3000ms | Max wait for a `get_property_response` |
| `SET_VERIFY_MS` | 2000ms | Delay after `set_property` before reading back |

These are hardcoded at the top of the script. Edit them if your network latency requires it.
