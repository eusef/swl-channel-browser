# SDRconnect WebSocket API Feature Requests

## Status

### Resolved in v1.0.7 (9th February 2026)

| Request | Status | Notes |
|---------|--------|-------|
| Writable `device_center_frequency` | Fixed | Was broken in 1.0.6, fixed in 1.0.7 |
| Writable `device_sample_rate` | Added | Now read-write in WebSocket API |
| Headless binary for WebSocket API | Added | Experimental `SDRconnect_headless` binary, no GUI required |
| Device selection by serial number | Added | Can open devices by serial number and display name via WebSocket API |

### Open Requests

| Request | Details |
|---------|---------|
| Headless binary documentation | The `SDRconnect_headless` binary is experimental and undocumented. Need docs on: WebSocket commands for device discovery/selection/start, expected startup behavior, and configuration options beyond `--websocket_port`. |
| Headless binary dependencies | The headless binary still initializes the Avalonia/SkiaSharp rendering pipeline, requiring `libfontconfig1` and `LD_LIBRARY_PATH=/opt/sdrconnect`. A truly headless build without GUI dependencies would simplify deployment on Raspberry Pi OS Lite. |
| Silent/unattended install (`-y` flag) | Both the SDRplay API `.run` installer and the SDRconnect `.run` installer require interactive input (license acceptance, install path, etc.). A `-y` or `--accept-license` flag that accepts defaults would enable fully automated provisioning of headless Raspberry Pi deployments without user interaction. Currently every install requires someone at the keyboard answering prompts, which blocks scripted/unattended setups (e.g. fleet provisioning, CI/CD pipelines, disk images). |
| systemd compatibility for headless binary | The headless binary works when launched manually (`sudo`) or via cron `@reboot`, but crashes (SIGABRT, exit 134) under every systemd service configuration tested. A `--daemon` or `--no-interactive` flag would allow it to run as a standard systemd service. See `SDRCONNECT_HEADLESS_API.md` "Known Issue: systemd Incompatibility" for full details. |

---

## Archive: Original Feature Request (v1.0.6)

**Requested for:** SDRconnect WebSocket API (tested on v1.0.6)
**Resolved in:** v1.0.7

### Problem

When setting `device_vfo_frequency` via the WebSocket API, SDRconnect recentered the spectrum display with the VFO positioned at approximately 10% from the left edge. The `device_center_frequency` property was read-only via WebSocket, so there was no way for an external application to center the VFO within the visible bandpass after tuning.

### Resolution

v1.0.7 fixed the issue with setting `device_center_frequency` via WebSocket API. The property is now writable as originally requested.

### Example Usage

```json
{ "event_type": "set_property", "property": "device_vfo_frequency", "value": "7200000" }
{ "event_type": "set_property", "property": "device_center_frequency", "value": "7200000" }
```

### Context

Discovered while building [SWL Channel Browser](https://github.com/eusef/swl-channel-browser), a web-based shortwave listening app that tunes an SDRplay receiver via the SDRconnect WebSocket API.
