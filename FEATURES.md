# SWL Channel Browser - Features

Last updated: 2026-03-02

## Schedule Browsing

- Browse active shortwave broadcasts from the EiBi database (~10,000 stations)
- Filter by band, language, or target region
- Search by station name or frequency
- "On Now" and "Coming Up" views (1, 3, or 6 hour lookahead)
- Auto-refresh of EiBi schedule (weekly)

## Tuning and Audio

- One-tap tuning from schedule, favorites, or manual entry
- VFO + center frequency tuning (spectrum centers on tuned station)
- DC spike avoidance for Zero-IF mode (auto 11 kHz offset at sample rates > 2 MHz)
- Automatic demod mode selection (AM, SAM, USB, LSB, CW, NFM, WFM)
- Automatic bandwidth selection per mode
- Live demod mode switching from the now-playing bar
- Config-level default demod mode override
- 48kHz WebSocket audio streaming to any device on the LAN
- Volume control, mute, play/pause
- In-browser recording (WebM/Opus with WAV export)

## Manual Frequency Entry (Issue #3)

- Collapsible manual tune form with frequency input (kHz or MHz)
- Optional station name and demod mode selection
- Auto-derived bandwidth based on demod mode
- Session-only manual entry list displayed above EiBi schedule
- Click to re-tune, delete individual entries, or clear all
- Mobile-friendly with 44px touch targets and `inputmode="decimal"`

## Curated Station Lists (Issue #4)

- Multiple named lists (replaces single favorites list)
- One-time migration from legacy favorites.json to lists.json
- Create, rename, and delete lists
- Horizontal scrollable tab selector with active highlight
- Right-click or long-press context menu for rename/delete (portal-based, renders above all content)
- Double-click list tab to rename inline
- Export individual lists as JSON
- Import lists from JSON files
- Per-list station count badges

## Save to List (Issue #6)

- Bookmark button in the now-playing bar (visible when tuned)
- Bottom-sheet modal with list picker
- Editable station name and optional notes
- "Create new list" option inline in the modal
- Toast confirmation on save
- Star toggle on schedule stations adds/removes from active list

## Interactive Waterfall (Issue #5)

- Click/tap anywhere on the spectrum or waterfall to tune to that frequency
- Drag left/right to pan the frequency across the band
- Crosshair cursor with real-time frequency readout tooltip
- EiBi station markers overlaid on the spectrum display (yellow dashed lines with station names)
- Automatic nearby broadcast lookup (fetches active EiBi stations within the visible 1 MHz span)
- Click on an EiBi marker to tune directly to that known broadcast
- Frequency readout flips side to stay visible near canvas edges

## SDR Controls (Issues #11/#13)

- Four collapsible control panels below the now-playing bar (all work in GUI and headless mode)
- **Gain panel:** LNA state slider with device-reported min/max range, +/- step buttons, AGC toggle, AGC threshold slider, inline OVERLOAD indicator
- **Audio panel:** SDR-side mute, audio limiters toggle, squelch enable with threshold slider (-150 to 0 dBm), noise reduction enable with strength slider (0-10)
- **Filters panel:** Mode-specific controls that auto-show for the current demod mode. WFM: stereo/RDS toggles. NFM: de-emphasis toggle + low-cut slider. AM/SAM: low-cut slider. USB/LSB: low-cut slider
- **Spectrum panel:** Reference level and base level sliders for spectrum/waterfall display range
- Compact summary lines when collapsed (current state at a glance)
- Optimistic UI updates with debounced WebSocket sends
- Post-set verification via get_property with timeout-based read-only detection
- Real-time WebSocket updates (no save button needed)

## SDR Property Test Script

- Standalone test script (`npm run test:sdr`) for auditing all SDRconnect WebSocket properties
- Tests 70 properties for readability and writability
- Safe write tests (toggles booleans back, restores numeric values)
- Produces categorized console report and JSON file (`sdr-property-report.json`)
- Connects through the app's WebSocket proxy (requires dev server running)
- Usable against GUI or headless SDRconnect instances

## Frequency Tweak Bar (Issue #14)

- Collapsible panel with +/- buttons for precise frequency stepping
- Step size selector: 100Hz, 1kHz, 5kHz, 9kHz, 10kHz (pill buttons)
- Long-press +/- for continuous stepping (150ms repeat)
- Current frequency display with kHz/MHz formatting
- Step size persisted in localStorage
- Left/Right arrow keyboard shortcuts for frequency adjustment
- Bypasses tune debounce for responsive rapid stepping

## Passband Zoom (Issue #15)

- Zoom presets in spectrum panel header: 2M, 1M, 500k, 200k, 100k, 50k
- Changes device sample rate to narrow/widen the visible spectrum
- Scroll wheel on spectrum/waterfall to zoom in/out (200ms debounce)
- +/- keyboard shortcuts for zoom stepping
- Active preset highlighted in the zoom bar

## Signal and Propagation

- Live signal power (dBm) and SNR (dB) meter
- Real-time spectrum display
- Scrolling waterfall spectrogram
- Solar flux and geomagnetic data from NOAA
- Per-band condition badges (Good/Fair/Poor)

## Reception Log

- Log receptions with auto-captured signal metrics
- Personal notes per entry
- Export log as CSV
- Recording playback and download from log page

## Platform and UX

- Installable as a PWA (iPhone, iPad, Android, desktop)
- Dark theme optimized for listening sessions
- Responsive layout (mobile cards + desktop table rows)
- Safe area support for notched iPhones
- 44px minimum touch targets throughout
- nRSP-ST "Advanced Controls" link to built-in web UI (port 9001)
- Antenna port selection for multi-port receivers (RSPdx-R2, RSPduo)
- Time format toggle (UTC/local)
- Device serial number selection for multi-device setups
- Automatic device selection on WebSocket connect (SDRconnect 1.0.7+)
- SDRconnect version detection with upgrade warning for < 1.0.7
- Full SDR property state capture on connect (~35 properties)

## Planned (Not Yet Implemented)

- Reception log support for ad-hoc and waterfall-tuned stations (Issue #7)
