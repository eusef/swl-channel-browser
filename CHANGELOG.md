# Changelog

All notable changes to the SWL Channel Browser are documented here.

## [Unreleased]

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
