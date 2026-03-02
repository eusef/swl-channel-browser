# Changelog

All notable changes to the SWL Channel Browser are documented here.

## [Unreleased]

### Issues #14/#15 - Frequency Tweak Bar + Passband Zoom

**Added**

- `FrequencyTweakBar` component: collapsible panel with +/- buttons for precise frequency stepping (100Hz, 1kHz, 5kHz, 9kHz, 10kHz step sizes)
- Long-press +/- for continuous stepping at 150ms intervals
- Step size persisted in localStorage
- `ZoomBar` component: inline zoom preset buttons in spectrum panel header (2M, 1M, 500k, 200k, 100k, 50k)
- Scroll wheel zoom on spectrum and waterfall displays (200ms debounce)
- `useKeyboardShortcuts` hook: Left/Right arrows for frequency adjust, +/- keys for zoom
- Direct `client.tune()` calls for tweak bar (bypasses handleTune 300ms debounce for responsive stepping)
- Zoom changes device sample rate via `client.setSampleRate()`

### Issue #13 - SDR WebUI Controls (Phase 1: Gain/AGC + Phase 2: Audio/Filters/Spectrum)

**Added**

- Collapsible "Gain" panel below the now-playing bar with real-time SDR controls
- LNA state slider with dynamic min/max from device-reported `lna_state_min`/`lna_state_max` (RF gain, 0-19 on nRSP-ST)
- AGC enable/disable toggle via `agc_enable` property (IF autogain)
- AGC threshold slider (0-100 dB) when AGC is enabled
- Overload detection with inline "OVERLOAD" indicator
- Collapsible "Audio" panel with SDR-side mute, audio limiters, squelch (enable + threshold), and noise reduction (enable + strength)
- Collapsible mode-specific "Filters" panel (auto-shows controls relevant to current demod mode):
  - WFM: stereo toggle, RDS decode toggle
  - NFM: de-emphasis toggle, low-cut frequency slider
  - AM/SAM: low-cut frequency slider
  - USB/LSB: low-cut frequency slider
- Collapsible "Spectrum" control panel with reference level and base level sliders
- Compact collapsed summaries on all panels showing current state at a glance
- `useSDRControls` hook expanded to manage 19 writable SDR properties with optimistic UI, debounced sends, and post-set verification
- `GainPanel` component with +/- step buttons for precise adjustments (44px touch targets)
- Timeout-based read-only detection for properties SDRconnect GUI mode doesn't support
- `scripts/sdr-property-test.ts` for auditing all 70 known WebSocket properties
- `npm run test:sdr` convenience script (requires dev server running)
- `sdr-property-report.json` output with categorized read/write results
- Works in both GUI mode (Mac/Windows) and headless mode (Raspberry Pi)

**Removed**

- IF gain reduction slider (device_if_gain_reduction not readable in GUI mode per property test)

### Issue #12 - SDRconnect 1.0.7 Upgrade

**Changed**

- `tune()` now sets both VFO and center frequency so the spectrum display centers on the tuned station
- `setCenterFrequency()` sends actual writes (was a no-op under 1.0.6)
- Removed all 1.0.6 workarounds and stale comments from `sdrconnect.ts`
- Device selection is now conditional: only sent when VFO reports "0" (headless mode with no active device), skipped when a device is already running (GUI mode)

**Added**

- DC spike avoidance for Zero-IF mode: auto 11 kHz center frequency offset at sample rates > 2 MHz (per SDRplay team guidance)
- Automatic device selection on WebSocket connect via `selected_device` (index) or `selected_device_serial` (serial number)
- Device serial number setting in Settings page for multi-device setups
- `setSampleRate()` method for writable sample rate (enables future passband zoom, Issue #15)
- `setProperty()` generic method for arbitrary SDR property writes (enables future gain controls, Issues #11/#13)
- `getPropertyValue()` and `getAllProperties()` for reading any stored SDR property
- Full SDR property state capture on connect (~35 properties stored in a Map)
- SDRconnect version detection: amber warning banner if no property data received within 5 seconds of connect
- `device_serial` field in AppConfig with server-side defaults and persistence

**Fixed**

- GUI mode (Mac/Windows) no longer receives false "upgrade required" warning
- Sending `selected_device` to GUI SDRconnect before device initialization no longer causes a crash

**Technical**

- `useWebSocket` hook accepts optional `deviceSerial` parameter from config
- `onVersionError` callback for UI integration of version detection
- Documented DC spike / Zero-IF behavior in `SDRCONNECT_HEADLESS_API.md`
- Updated `FEATURES.md` with all new capabilities
