# SDRconnect WebSocket API Feature Request

## Writable `device_center_frequency` Property

**Requested for:** SDRconnect WebSocket API (tested on v1.0.6)

### Problem

When setting `device_vfo_frequency` via the WebSocket API, SDRconnect recenters the spectrum display with the VFO positioned at approximately 10% from the left edge. The `device_center_frequency` property is currently read-only via WebSocket, so there is no way for an external application to center the VFO within the visible bandpass after tuning.

This matters for applications that make large frequency jumps (e.g., hopping between HF bands), where the VFO consistently ends up near the edge of the display rather than centered.

### Requested Change

Make `device_center_frequency` writable via `set_property` in the WebSocket API, allowing external clients to position the spectrum display center independently of the VFO frequency.

### Example Usage

```json
{ "event_type": "set_property", "property": "device_vfo_frequency", "value": "7200000" }
{ "event_type": "set_property", "property": "device_center_frequency", "value": "7200000" }
```

This would allow the VFO to appear at the center of the spectrum display after tuning.

### Context

Discovered while building [SWL Channel Browser](https://github.com/eusef/swl-channel-browser), a web-based shortwave listening app that tunes an SDRplay receiver via the SDRconnect WebSocket API. Multiple workarounds were attempted (overshoot tuning, delayed double-VFO commands, varying timing) but none reliably center the VFO because SDRconnect recenters the display on every VFO change.
