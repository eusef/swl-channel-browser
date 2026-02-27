# SWL Channel Browser - Features

Last updated: 2026-02-27

## Schedule Browsing

- Browse active shortwave broadcasts from the EiBi database (~10,000 stations)
- Filter by band, language, or target region
- Search by station name or frequency
- "On Now" and "Coming Up" views (1, 3, or 6 hour lookahead)
- Auto-refresh of EiBi schedule (weekly)

## Tuning and Audio

- One-tap tuning from schedule, favorites, or manual entry
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

## Planned (Not Yet Implemented)

- Interactive waterfall with click/drag-to-tune and EiBi overlay (Issue #5)
- Reception log support for ad-hoc and waterfall-tuned stations (Issue #7)
