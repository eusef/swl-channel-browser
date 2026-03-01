# SDRconnect Headless Binary & WebSocket API Reference

> Compiled from official SDRconnect WebSocket API v1.0.1 documentation, binary strings extraction, and runtime testing.
> SDRconnect v1.0.7 build 22b2d4724 (9th February 2026).
> The headless binary is experimental. Official API doc: `SDRconnect_WebSocket_API.pdf` (v1.0.1).

## Headless Binary

**Location:** `/opt/sdrconnect/SDRconnect_headless` (57 MB, ARM64)

**Usage:**

```
SDRconnect_headless [--help] [--websocket_port=<port>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--help` | - | Show usage |
| `--websocket_port=<port>` | 5454 | WebSocket API listen port |

**Runtime requirements:**

| Requirement | Details |
|-------------|---------|
| Root access | Must run as root for USB device access via libusb |
| `sdrplay.service` disabled | The headless binary runs its own internal API service; disable the standalone daemon to avoid conflicts |
| `LD_LIBRARY_PATH=/opt/sdrconnect` | Required for SkiaSharp/Avalonia native library loading |
| `libfontconfig1` | System package required by SkiaSharp (not included in Pi OS Lite) |
| `libmp3lame-dev` | Required for MP3 encoding support |
| Working directory | Must be `/opt/sdrconnect/` for port 5454 to bind to LAN interface |
| `.so` permissions | `chmod 755 /opt/sdrconnect/*.so` (installer sets root-only by default) |
| udev rules | USB product ID must be in `/etc/udev/rules.d/66-sdrplay.rules` (nRSP-ST `0x3040` may be missing) |

**Startup behavior:**
- Binds WebSocket server to port 5454 on all interfaces (localhost + LAN IP)
- Does NOT auto-connect to an SDR device (frequency reports as `0`)
- Device must be opened via WebSocket API command (see Open Questions below)

**Config file:** `~/.sdrconnect/config.json`

The headless binary reads from the same config as the GUI. A minimal config is created on first run:

```json
{
    "networkserver_sources": null
}
```

The GUI version requires `WebSocketInterfaceEnabled: true` in settings. Unknown whether the headless binary requires this or enables WebSocket by default (port 5454 binds either way, but API responsiveness may differ).

## WebSocket API

### Connection

Connect via WebSocket to `ws://<host>:5454/`. The API uses JSON text messages for commands/responses and binary messages for audio/spectrum data.

> **Critical:** WebSocket compression (`permessage-deflate`) must be **disabled**. SDRconnect's WatsonWebsocket server rejects connections that include the `Sec-WebSocket-Extensions: permessage-deflate` header (returns HTTP 404). In Node.js: `new WebSocket(url, { perMessageDeflate: false })`.

### Message Format

**Request (get property):**
```json
{ "event_type": "get_property", "property": "<property_name>" }
```

**Request (set property):**
```json
{ "event_type": "set_property", "property": "<property_name>", "value": "<value>" }
```

**Response:**
```json
{ "event_type": "get_property_response", "property": "<property_name>", "value": "<value>" }
```

**Server push (property changed):**
```json
{ "event_type": "property_changed", "property": "<property_name>", "value": "<value>" }
```

### Confirmed Properties (tested)

| Property | Read | Write | Value Type | Notes |
|----------|------|-------|------------|-------|
| `device_vfo_frequency` | Yes | Yes | Hz string (e.g. `"7200000"`) | Returns `"0"` when no device connected |
| `device_center_frequency` | Yes | Yes (1.0.7) | Hz string | Was broken in 1.0.6, fixed in 1.0.7 |
| `device_sample_rate` | Yes | Yes (1.0.7) | Hz string | Changed to read-write in 1.0.7 |
| `iq_sample_rate` | Yes | ? | Hz string | IQ sample rate |
| `demodulator` | Yes | Yes | Mode string | Demodulation mode |
| `filter_bandwidth` | Yes | Yes | Hz string | Demodulator filter bandwidth |
| `antenna_select` | ? | Yes | Port string | Antenna port selection |
| `signal_power` | Yes | No | dBm string | Signal power level |
| `signal_snr` | Yes | No | dB string | Signal-to-noise ratio |

### Event Types (from official API doc v1.0.1)

**Property operations:**

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `get_property` | Client -> Server | Request a property value |
| `set_property` | Client -> Server | Set a property value |
| `get_property_response` | Server -> Client | Response to get_property |
| `property_changed` | Server -> Client | Push notification when property changes |

**Device selection (new in 1.0.7):**

| Event Type | Direction | Value | Description |
|------------|-----------|-------|-------------|
| `selected_device` | Client -> Server | Device index (e.g. `"0"`) | Select device by index |
| `selected_device_serial` | Client -> Server | Serial string (e.g. `"2405169050"`) | Select device by serial number |
| `selected_device_name` | Client -> Server | Display name string | Select device by display name |

**Streaming control:**

| Event Type | Direction | Value | Description |
|------------|-----------|-------|-------------|
| `device_stream_enable` | Client -> Server | `"true"` / `"false"` | Start/stop device streaming |
| `audio_stream_enable` | Client -> Server | `"true"` / `"false"` | Enable/disable audio stream |
| `spectrum_enable` | Client -> Server | `"true"` / `"false"` | Enable/disable spectrum data stream |

**Additional properties from official docs:**

| Property | Read | Write | Value Type | Notes |
|----------|------|-------|------------|-------|
| `started` | Yes | No | Boolean string | `"true"` when device is streaming |

### Binary Messages

| Header (Int16) | Type | Format |
|----------------|------|--------|
| `0x0003` | Spectrum data | 2-byte header + Uint8 FFT bins |
| Other | Audio PCM | Int16 samples |

### Properties Found in Binary (not yet tested)

Extracted via `strings` from the binary. These are internal .NET interface methods that suggest available WebSocket properties:

**Device control:**

| Internal Method | Likely Property | Read/Write |
|----------------|-----------------|------------|
| `GetDevicePpmCorrection` / `SetDevicePpmCorrection` | `device_ppm_correction` | R/W |
| `GetDeviceAntennaInput` / `SetDeviceAntennaInput` | `device_antenna_input` | R/W |
| `GetDeviceSwapIq` / `SetDeviceSwapIq` | `device_swap_iq` | R/W |
| `GetDeviceRepeatEnable` / `SetDeviceRepeatEnable` | `device_repeat_enable` | R/W |
| `GetDeviceSeek` / `SetDeviceSeek` | `device_seek` | R/W |

**Device state (read-only):**

| Internal Method | Likely Property |
|-----------------|-----------------|
| `GetCanSetCenterFrequency` | `can_set_center_frequency` |
| `GetCanSetSampleRate` | `can_set_sample_rate` |
| `GetSupportsZeroIfMode` | `supports_zero_if_mode` |
| `GetCanSetDisplayFftSize` | `can_set_display_fft_size` |
| `GetCanSetDisplayFftRate` | `can_set_display_fft_rate` |
| `GetSupportsMultipleVrx` | `supports_multiple_vrx` |
| `GetSupportsHdr` | `supports_hdr` |
| `GetSupportsDiversity` | `supports_diversity` |
| `GetSupportsFullIQ` | `supports_full_iq` |
| `GetHaveExclusiveControl` | `have_exclusive_control` |
| `GetDeviceMaxSampleRate` | `device_max_sample_rate` |
| `GetDeviceMaxCenterFrequency` | `device_max_center_frequency` |
| `GetHasMultipleAntennas` | `has_multiple_antennas` |
| `GetHasBiasT` | `has_bias_t` |
| `GetHasRfNotch` | `has_rf_notch` |
| `GetHasDabNotch` | `has_dab_notch` |
| `GetHasRefClkOutput` | `has_ref_clk_output` |
| `GetDisplayFftRateMin` | `display_fft_rate_min` |
| `GetDisplayFftRateMax` | `display_fft_rate_max` |
| `GetDisplayFftRateDefault` | `display_fft_rate_default` |

**Hardware settings:**

| Internal Method | Likely Property |
|-----------------|-----------------|
| `GetDeviceIfAgcAttack` | `device_if_agc_attack` |
| `GetDeviceIfAgcDecay` | `device_if_agc_decay` |
| `GetDeviceIfAgcDecayDelay` | `device_if_agc_decay_delay` |
| `GetDeviceIfAgcDecayThreshold` | `device_if_agc_decay_threshold` |
| `GetDeviceIfGainReduction` | `device_if_gain_reduction` |
| `GetDeviceAgcEnable` | `device_agc_enable` |
| `GetDeviceRfNotchEnabled` | `device_rf_notch_enabled` |
| `GetDeviceDabNotchEnabled` | `device_dab_notch_enabled` |
| `GetDeviceLowIfEnabled` | `device_low_if_enabled` |
| `GetDeviceBiasTEnabled` | `device_bias_t_enabled` |
| `GetDeviceHdrModeEnabled` | `device_hdr_mode_enabled` |
| `GetDeviceDiversityEnabled` | `device_diversity_enabled` |
| `GetDeviceRefClkOutputEnabled` | `device_ref_clk_output_enabled` |
| `GetDeviceSetPointMax` | `device_set_point_max` |

**Device struct fields (coreradio_device_t):**

Found in `swig_bindings.so` - these are the fields of the device object:

| Field | Description |
|-------|-------------|
| `id` | Device ID |
| `displayName` | Human-readable device name |
| `type` | Device type (string) |
| `deviceType` | Device type (enum) |
| `breadcrum` | Device breadcrumb/path |
| `autoDiscovered` | Whether auto-discovered |
| `nRsp` | nRSP-ST related |
| `hasSecondaryReceiver` | Dual tuner support (RSPduo) |

**Global settings found in binary:**

| Setting | Notes |
|---------|-------|
| `WebSocketInterfaceEnabled` | Must be true for WebSocket API to process messages |
| `DeviceDiscoveryEnabled` | Enables automatic device discovery |
| `ShowSidebarDeviceControls` | GUI-only |
| `IARURegionIndex` | IARU region setting |
| `RdsStandardIndex` | RDS decoder region |
| `RecordingsFolder` | Recording save path |

## Config File Reference

**Location:** `~/.sdrconnect/config.json`

**Known keys:**

```json
{
    "networkserver_sources": null,
    "WebSocketInterfaceEnabled": true,
    "DeviceDiscoveryEnabled": true
}
```

> **Note:** The exact key names in the JSON config may not match the .NET property names found via `strings`. Testing is needed to confirm the correct JSON key names.

## Device Connection Sequence (from official docs)

The expected startup sequence per the official WebSocket API documentation:

```
1. Connect WebSocket to ws://<host>:5454/
2. Select device:  { "event_type": "selected_device", "value": "0" }
   -or-           { "event_type": "selected_device_serial", "value": "<serial>" }
   -or-           { "event_type": "selected_device_name", "value": "<display_name>" }
3. Start stream:   { "event_type": "device_stream_enable", "value": "true" }
4. Verify:         { "event_type": "get_property", "property": "started" }
   Expected:       { "event_type": "get_property_response", "property": "started", "value": "true" }
```

### Testing Status (WORKING)

Device selection via `selected_device` with index `"0"` works correctly. The earlier failures were caused by WebSocket `permessage-deflate` compression being enabled (the Python `websockets` library and Node.js `ws` library both enable it by default). With compression disabled, the device connects immediately and streams signal data.

| Method | Command Sent | Result |
|--------|-------------|--------|
| By index | `selected_device` value `"0"` (perMessageDeflate: false) | Device started, signal streaming |
| By serial | `selected_device_serial` value `"2405169050"` | Not retested after fix |
| Stream enable | `device_stream_enable` value `"true"` | Not needed when using `selected_device` (auto-starts) |

Properties received after `selected_device`:
`started`, `can_control`, `device_center_frequency`, `device_vfo_frequency`, `device_sample_rate`, `demodulator`, `filter_bandwidth`, `lna_state`, `lna_state_min`, `lna_state_max`, `agc_enable`, `agc_threshold`, `squelch_enable`, `squelch_threshold`, `noise_reduction_enable`, `noise_reduction_strength`, `audio_volume_percent`, `audio_mute`, `audio_filter`, `audio_limiters`, `spectrum_ref_level`, `spectrum_base`, `wfm_stereo`, `wfm_stereo_enable`, `rds_enable`, `rds_ps`, `rds_pi`, `rds_pty`, `overload`, `signal_power`, `signal_snr`, `demod_max_bandwidth`, `am_lowcut_frequency`, `ssb_lowcut_frequency`, `nfm_lowcut_frequency`, `nfm_deemphasis_enable`

## Resolved Issues

1. **WebSocket 404 errors:** Caused by `permessage-deflate` compression. SDRconnect's WatsonWebsocket server rejects the `Sec-WebSocket-Extensions` header. Fix: disable compression in all WebSocket clients.

2. **Device selection "silently failing":** Was actually working, but the 404 from compression meant the commands never reached the server. With compression disabled, `selected_device` with value `"0"` works immediately.

3. **Headless binary requires root and a pseudo-TTY:** The binary needs root to access USB devices via `libusb`. Running as a regular user produces `libusb_open() -3` (permission denied). It also requires a pseudo-TTY to stay running (without one, the .NET runtime exits immediately on Trixie). A systemd service wrapping the binary with `script -qfc` and `Restart=always` is the most reliable startup method.

4. **`sdrplay.service` conflicts:** The headless binary runs its own internal SDRplay API service. Having the standalone `sdrplay.service` running simultaneously can cause device access conflicts. Disable `sdrplay.service` when using the headless binary.

5. **nRSP-ST missing from udev rules:** The SDRplay API installer's udev rules (`66-sdrplay.rules`) do not include product ID `0x3040` (nRSP-ST). Must be added manually.

## Known Issue: systemd Incompatibility (for SDRplay team)

The headless binary cannot run reliably as a systemd service. It works perfectly when launched manually from an interactive root shell (`sudo`), but enters a crash loop (SIGABRT, exit code 134) when managed by systemd. The binary calls `sdrplay_api_Open`, immediately calls `sdrplay_api_Close`, then aborts.

**Behavior observed:**

| Launch method | Result |
|---------------|--------|
| `sudo ./SDRconnect_headless` from SSH | Works. Port 5454 binds, WebSocket API responds, device streams. |
| systemd `Type=simple`, `User=root` | Abort (exit 134). Crash loop. |
| systemd `Type=forking`, `ExecStart=/bin/bash -lc '... &'` | Works after manual `systemctl restart`, but aborts on boot. |
| systemd with `ProtectHome=no`, `PrivateTmp=no`, `ProtectSystem=no` | Abort (exit 134). |
| systemd with full env (`HOME=/root`, `TERM=xterm-256color`, full `PATH`) | Abort (exit 134). |
| systemd wrapped in `script -qc` (pseudo-TTY) | Abort (exit 134). |
| systemd with `ExecStartPre=/bin/sleep 15` (USB settle delay) | Abort (exit 134). USB device is present in `lsusb`. |
| `setsid` from interactive shell | Binary does not survive detachment from session. |
| Root cron `@reboot` job (without PTY) | Works on Bookworm, exits immediately on Trixie. |
| Root cron `@reboot` with `script -qfc` (pseudo-TTY, no setsid) | Works manually, but cron kills process when @reboot job exits. |
| Root cron `@reboot` with `setsid script -qfc` | Works manually but unreliable from cron on Trixie. |
| systemd service with `script -qfc` + `Restart=always` | Works on both Bookworm and Trixie. Survives reboot reliably. |

**systemd unit file tested (final iteration before abandoning):**

```ini
[Unit]
Description=SDRconnect Headless
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=root
Environment=HOME=/root
Environment=TERM=xterm-256color
Environment=LD_LIBRARY_PATH=/opt/sdrconnect
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
WorkingDirectory=/opt/sdrconnect
ExecStartPre=/bin/sleep 15
ExecStart=/bin/bash -lc 'cd /opt/sdrconnect && LD_LIBRARY_PATH=/opt/sdrconnect ./SDRconnect_headless &'
Restart=on-failure
RestartSec=5
ProtectHome=no
PrivateTmp=no
ProtectSystem=no

[Install]
WantedBy=multi-user.target
```

**Journal output during crash loop:**

```
SDRconnect_headless[...]: sdrplay_api_Open
SDRconnect_headless[...]: sdrplay_api_Close
systemd[1]: sdrconnect-headless.service: Main process exited, code=exited, status=134/n/a
systemd[1]: sdrconnect-headless.service: Failed with result 'exit-code'.
```

The restart counter reached 30+ before we stopped the service.

**Workaround:** systemd service wrapping the binary with `script -qfc` for a pseudo-TTY, and `Restart=always` to handle first-boot timing:

```ini
[Unit]
Description=SDRconnect Headless
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Environment=HOME=/root
Environment=TERM=xterm-256color
Environment=LD_LIBRARY_PATH=/opt/sdrconnect
WorkingDirectory=/opt/sdrconnect
ExecStartPre=/bin/sleep 15
ExecStart=/usr/bin/script -qfc './SDRconnect_headless' /dev/null
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Analysis:** The binary requires a pseudo-TTY (controlling terminal) to stay running. On Debian Bookworm, a plain cron `@reboot` was sufficient. On Debian Trixie (13), the binary exits immediately without a PTY - it prints its banner and quits without even attempting `sdrplay_api_Open`. The `script -qfc` wrapper allocates a PTY. The binary may exit cleanly (status 0) on the first boot attempt before USB is fully ready, so `Restart=always` ensures systemd restarts it and the second attempt succeeds. Cron-based approaches (`setsid script -qfc`) worked manually but were unreliable at boot on Trixie due to process group cleanup. The systemd service approach provides proper lifecycle management.

**Recommendation for SDRplay:** Adding a `--daemon` or `--no-interactive` flag that allows the headless binary to run cleanly under systemd would greatly improve deployment on headless Linux systems (Raspberry Pi, servers, embedded). The current behavior makes it incompatible with standard Linux service management.

## Open Questions

1. **Is there a way to list available devices via WebSocket?** The C API has `sdrplay_api_GetDevices()` but no WebSocket equivalent is documented.

2. **Does `selected_device_name` work?** Not tested. The display name for devices is unknown.

3. **Can the headless binary auto-select a device on startup?** Currently requires a WebSocket command after startup.

## Tested On

- Raspberry Pi 4 (4 GB), Raspberry Pi OS Lite (64-bit, Bookworm and Trixie)
- SDRplay nRSP-ST (USB ID `1df7:3040`, serial `2405169050`)
- SDRconnect 1.0.7 build 22b2d4724
- SDRplay API v3.15.2
- Node.js v22.22.0

## Last Updated

2026-03-01
