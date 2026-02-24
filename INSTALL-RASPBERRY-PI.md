# Raspberry Pi Installation Guide

> **Fair warning:** This setup process is not for the faint of heart. SDRconnect's WebSocket API on the Pi requires a desktop environment, VNC, XWayland, a permissions fix on shared libraries, and a mouse-click automation workaround to auto-connect the SDR device on boot. It is brittle - a screen resolution change, an SDRconnect update, or a USB timing issue can break the auto-connect. That said, once configured, it does work reliably as an always-on listening station. Just be prepared to VNC in and troubleshoot if something shifts after an update.

Turn a Raspberry Pi 4 into an always-on shortwave listening appliance. The Pi runs the SWL Channel Browser backend and SDRconnect, connecting to your SDRplay receiver over USB. You access the app from any device on your LAN via `http://swl-channel-browser.local:3000`.

## What You Need

| Item | Notes |
|------|-------|
| Raspberry Pi 4 (4 GB+ RAM) | 4 GB recommended. 2 GB works but is tight with the desktop environment. |
| microSD card (16 GB+) | 32 GB recommended |
| Power supply | Official USB-C 5.1V/3A recommended |
| WiFi or Ethernet | WiFi is fine for this setup |
| SDRplay receiver | Connected via USB to the Pi (RSP1B, RSPdx-R2, RSPduo, or nRSP-ST) |
| Another computer | For flashing the SD card, SSH, and VNC access |
| VNC client | RealVNC Viewer or similar (needed for one-time SDRconnect setup) |

## Why Desktop Instead of Lite?

SDRconnect's WebSocket API (port 5454) is only available when SDRconnect runs in GUI mode. The `--server` CLI mode only exposes port 50000 (native protocol), which does not include the WebSocket API. The Pi runs the desktop environment with VNC so SDRconnect has a display server, but you don't need a physical monitor attached.

## 1. Flash Raspberry Pi OS Desktop (64-bit)

Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your computer.

1. Open Raspberry Pi Imager
2. Choose **Raspberry Pi 4** as the device
3. Choose **Raspberry Pi OS (64-bit)** - the **Desktop** version (not Lite)
4. Click the gear icon (or "Edit Settings") to pre-configure:

| Setting | Value |
|---------|-------|
| Hostname | `swl-channel-browser` |
| Enable SSH | Yes, password authentication |
| Username | Your choice (e.g. `phil`) |
| Password | Your choice |
| WiFi SSID | Your WiFi network name |
| WiFi Password | Your WiFi password |
| WiFi Country | Your country code (e.g. US) |
| Locale/Timezone | Your timezone |

5. Write to the SD card

Insert the SD card into the Pi, plug in the SDRplay receiver via USB, and power on. Wait about 2 minutes for first boot.

## 2. Connect via SSH

From your computer:

```bash
ssh phil@swl-channel-browser.local
```

If `.local` resolution doesn't work, find the Pi's IP from your router's admin page and use that instead.

## 3. Update the System

```bash
sudo apt update && sudo apt upgrade -y
```

## 4. Install the SDRplay API Driver

The API driver provides low-level USB access to SDRplay hardware. Download the ARM64 `.run` installer from the [SDRplay API page](https://www.sdrplay.com/api/).

Transfer to the Pi from your computer:

```bash
scp ~/Downloads/SDRplay_RSP_API-ARM64-3.15.2.run phil@swl-channel-browser.local:~/Downloads/
```

On the Pi:

```bash
chmod +x ~/Downloads/SDRplay_RSP_API-ARM64-3.15.2.run
sudo ~/Downloads/SDRplay_RSP_API-ARM64-3.15.2.run
```

Verify the service is running:

```bash
systemctl status sdrplay.service
```

Should show `active (running)`.

## 5. Install SDRconnect

Install the required MP3 encoding dependency:

```bash
sudo apt install -y libmp3lame-dev
```

Download the ARM64 installer from the [SDRconnect page](https://www.sdrplay.com/sdrconnect/). Transfer to Pi and run:

```bash
sudo ./SDRconnect_linux-arm64_22b2d4724.run
```

The installer asks several questions. Answer **y** to all for a standard install.

**Critical: Fix shared library permissions.** The installer sets `.so` files to root-only. Without this fix, SDRconnect crashes with `DllNotFoundException: Unable to load shared library 'swig_bindings'`:

```bash
sudo chmod 755 /opt/sdrconnect/*.so
```

Add SDRconnect to your PATH:

```bash
echo 'export PATH=/opt/sdrconnect:$PATH' >> ~/.bashrc
source ~/.bashrc
```

> **Note:** The exact `.run` filenames change with each release. Check the [SDRplay Downloads page](https://www.sdrplay.com/downloads/) for current filenames.

## 6. Install XWayland

Pi OS Bookworm uses Wayland (labwc compositor) by default. SDRconnect is an X11 application and needs XWayland to render:

```bash
sudo apt install -y xwayland
```

## 7. Enable VNC and Configure Display

```bash
sudo raspi-config
```

Set three things:

| Menu Path | Setting |
|-----------|---------|
| System Options > Boot / Auto Login | Desktop Autologin |
| Interface Options > VNC | Enable |
| Display Options > Screen Blanking | Disable |

Add a dummy HDMI output so the desktop renders without a physical monitor:

```bash
echo -e "\nhdmi_force_hotplug=1" | sudo tee -a /boot/firmware/config.txt
```

## 8. Disable SDRconnect Server Mode Service

The SDRconnect installer creates a systemd service that runs in `--server` mode. This only exposes port 50000 (native protocol), not port 5454 (WebSocket API). Disable it:

```bash
sudo systemctl stop sdrconnect.service
sudo systemctl disable sdrconnect.service
```

The API daemon (`sdrplay.service`) must remain enabled. Only the SDRconnect server service is disabled.

## 9. Configure SDRconnect Desktop Autostart

SDRconnect must be launched from its install directory for port 5454 to bind to the LAN interface (not just localhost):

```bash
mkdir -p ~/.config/autostart

cat > ~/.config/autostart/sdrconnect.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=SDRconnect
Exec=bash -c "cd /opt/sdrconnect && ./SDRconnect"
Path=/opt/sdrconnect
Hidden=false
X-GNOME-Autostart-enabled=true
EOF
```

## 10. First Launch - Enable WebSocket API (One-Time Setup)

Reboot:

```bash
sudo reboot
```

Connect via VNC from your computer (use RealVNC Viewer or similar, connect to `swl-channel-browser.local`).

In the SDRconnect GUI:

1. Open Settings/Preferences
2. Find the **WebSocket** option and **enable it**
3. Click the green **Start/Stop** triangle to connect to the SDR device
4. Verify the waterfall/spectrum display is active
5. **Gracefully close** SDRconnect (File > Exit or close the window) so settings are saved

This step only needs to be done once. The WebSocket setting persists in `~/.sdrconnect/config.json`.

## 11. Install xdotool and Create Startup Script

SDRconnect does not auto-connect to the SDR device on launch, and the center frequency defaults to whatever was last used. We use a startup script that clicks the Start/Stop button and then sets the center frequency to 10 MHz for good shortwave broadcast band coverage.

```bash
sudo apt install -y xdotool
```

Create the startup script:

```bash
cat > ~/sdrconnect-startup.sh << 'SCRIPT'
#!/bin/bash
# Wait for SDRconnect to launch
sleep 20

# Click the Start/Stop button to connect the device
DISPLAY=:0 xdotool mousemove 22 113
sleep 1
DISPLAY=:0 xdotool click 1

# Wait for device to connect
sleep 5

# Set center frequency to 10 MHz for shortwave coverage
python3 -c "
import asyncio, websockets, json
async def setup():
    async with websockets.connect('ws://127.0.0.1:5454/') as ws:
        await ws.send(json.dumps({'event_type':'set_property','property':'device_center_frequency','value':'10000000'}))
        await asyncio.sleep(1)
asyncio.run(setup())
"
SCRIPT
chmod +x ~/sdrconnect-startup.sh
```

Create the autostart entry that calls the script:

```bash
cat > ~/.config/autostart/sdrconnect-autoconnect.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=SDRconnect Auto-Connect
Exec=/home/phil/sdrconnect-startup.sh
Hidden=false
X-GNOME-Autostart-enabled=true
EOF
```

**Note:** The xdotool coordinates (22, 113) correspond to the Start/Stop button at 1920x1080 resolution. If you change screen resolution, you may need to recalibrate. Hover over the button in VNC and run `DISPLAY=:0 xdotool getmouselocation` to find updated coordinates. The center frequency (10 MHz / 10000000 Hz) with the default 2 MHz sample rate covers roughly 9-11 MHz, which includes the popular 31m and 25m shortwave bands. Adjust as needed for your preferred listening range.

## 12. Verify SDRconnect Setup

Reboot:

```bash
sudo reboot
```

Wait ~45 seconds, then verify from your computer. First install the Python websockets library if you don't have it:

```bash
pip3 install websockets
```

Then test (replace the IP with your Pi's address):

```bash
python3 -c "
import asyncio, websockets, json
async def test():
    async with websockets.connect('ws://swl-channel-browser.local:5454/') as ws:
        await ws.send(json.dumps({'event_type':'get_property','property':'device_vfo_frequency'}))
        r = await asyncio.wait_for(ws.recv(), timeout=5)
        print(r)
asyncio.run(test())
"
```

If `swl-channel-browser.local` doesn't resolve for WebSocket connections, use the Pi's IP address directly (e.g. `ws://192.168.1.202:5454/`).

Expected output (non-zero frequency):

```json
{
  "event_type": "get_property_response",
  "property": "device_vfo_frequency",
  "value": "9500000"
}
```

If the value is `"0"`, the xdotool auto-connect may not have fired yet. Wait another 30 seconds and retry, or VNC in to check if the device is connected.

## 13. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node --version   # should show v22.x
npm --version
```

## 14. Install Git (if not already present)

```bash
sudo apt install -y git
```

## 15. Install the App

```bash
cd /opt
sudo git clone https://github.com/eusef/swl-channel-browser.git
sudo chown -R $(whoami):$(whoami) /opt/swl-channel-browser
cd /opt/swl-channel-browser
npm install
```

## 16. Configure

Create the `.env` file:

```bash
cat > /opt/swl-channel-browser/.env <<EOF
PORT=3000
SDRCONNECT_HOST=127.0.0.1
SDRCONNECT_PORT=5454
EOF
```

If SDRconnect is running on this Pi (steps 4-12), the default `127.0.0.1` is correct.

**If SDRconnect runs on a different machine**, change `SDRCONNECT_HOST` to that machine's IP address.

## 17. Build for Production

Development mode (`npm run dev`) works but uses more CPU and memory. For a headless appliance, build once and run the compiled version:

```bash
cd /opt/swl-channel-browser
npm run build
```

Test it:

```bash
npm start
```

Open `http://swl-channel-browser.local:3000` from another device on your network. If the page loads and you can browse stations, press `Ctrl+C` to stop.

## 18. Auto-Start the App on Boot (systemd)

Create a systemd service so the app starts automatically when the Pi powers on:

```bash
sudo tee /etc/systemd/system/swl-channel-browser.service > /dev/null <<EOF
[Unit]
Description=SWL Channel Browser
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=/opt/swl-channel-browser
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable swl-channel-browser
sudo systemctl start swl-channel-browser
```

Check that it's running:

```bash
sudo systemctl status swl-channel-browser
```

View logs:

```bash
journalctl -u swl-channel-browser -f
```

## 19. Set Up Avahi (mDNS)

Avahi lets other devices find the Pi at `swl-channel-browser.local` without knowing its IP. It's usually pre-installed on Raspberry Pi OS, but verify:

```bash
sudo apt install -y avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

To verify:

```bash
hostname
# should print: swl-channel-browser
```

## 20. Safe Power Removal (Read-Only Filesystem) - Optional

SD cards can corrupt if the Pi loses power during a write. Enabling the overlay filesystem makes the root partition read-only with a temporary RAM overlay. Writes go to RAM and are discarded on reboot, so the SD card is always in a clean state and safe to unplug at any time.

### Trade-offs

| What works | What doesn't persist across reboots |
|------------|-------------------------------------|
| App runs normally | Favorites, reception log, config changes made in the UI |
| EiBi schedule loads from the pre-built copy | EiBi schedule updates (re-downloads after re-enabling writes) |
| Tuning, streaming, all real-time features | System logs, apt packages, any file changes |
| SDRconnect settings (already saved) | New SDRconnect setting changes |

**If you need persistent favorites and logs**, skip this section. The Pi will still work fine - just use a quality SD card and avoid yanking power while the disk activity LED is lit.

### Enable the Overlay Filesystem

1. Make sure everything is set up and working first (steps 1-19)
2. Run raspi-config:

```bash
sudo raspi-config
```

3. Navigate to **Performance Options** > **Overlay File System**
4. Select **Yes** to enable the overlay filesystem
5. Select **Yes** to write-protect the boot partition
6. Reboot when prompted

The Pi is now safe to unplug at any time.

### Temporarily Disable for Updates

To update the app, install packages, or change config, disable the overlay:

```bash
sudo raspi-config
# Performance Options -> Overlay File System -> No
# Reboot
```

After making your changes, re-enable the overlay the same way.

## Updating the App

If the overlay filesystem is enabled, disable it first (see above). Then:

```bash
cd /opt/swl-channel-browser
git pull
npm install
npm run build
sudo systemctl restart swl-channel-browser
```

Re-enable the overlay filesystem when done.

## Ports and Services

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| SWL Channel Browser | 3000 | HTTP | Web app and schedule API |
| SDRconnect WebSocket | 5454 | WebSocket | Radio control, tune, demod, signal data, audio |
| sdrplay.service | N/A | N/A | USB device driver daemon (must be running) |
| SSH | 22 | TCP | Remote terminal access |
| VNC | 5900 | TCP | Remote desktop (needed for SDRconnect GUI) |

## Verification Checklist

| Check | How to verify | Expected |
|-------|---------------|----------|
| SSH access | `ssh phil@swl-channel-browser.local` | Login succeeds |
| VNC access | Connect VNC to `swl-channel-browser.local` | Desktop visible, SDRconnect window open |
| SDRplay API running | `systemctl status sdrplay.service` (on Pi) | `active (running)` |
| Port 5454 open | `ss -tlnp \| grep 5454` (on Pi) | Three listeners including LAN IP |
| WebSocket responds | Python test from step 12 | JSON response with non-zero frequency |
| Signal data streaming | Connect WebSocket and listen | `signal_power` and `signal_snr` events every ~500ms |
| App accessible | Open `http://swl-channel-browser.local:3000` in browser | Station list loads |
| Survives reboot | Power cycle Pi, wait 45s, test WebSocket + app | Everything works without manual intervention |

## Troubleshooting

**SDRconnect crashes with `DllNotFoundException: swig_bindings`**
The installer sets `.so` files to root-only permissions. Fix: `sudo chmod 755 /opt/sdrconnect/*.so`

**Port 5454 not listening at all**
The WebSocket API is off by default. VNC into the Pi, open SDRconnect settings, enable WebSocket, then gracefully exit to save. This only needs to be done once.

**Port 5454 only on localhost (127.0.0.1), not on LAN IP**
SDRconnect must be launched from `/opt/sdrconnect/` directory. Check the autostart entry uses `Exec=bash -c "cd /opt/sdrconnect && ./SDRconnect"`

**SDR device not connected after boot (frequency = 0)**
SDRconnect does not auto-connect. The xdotool autostart (step 11) clicks the Start/Stop button after a 20-second delay. If the device still isn't connected, the delay may be too short - increase the `sleep 20` value in the autostart entry.

**SDR device not detected by SDRconnect**
The USB device may not be ready at boot. Try physically disconnecting and reconnecting the USB cable, then click Refresh in SDRconnect. If this happens consistently, increase the xdotool delay.

**`--server` mode only exposes port 50000, not 5454**
This is expected. The `--server` CLI flag starts the native client-server protocol only. The WebSocket API requires GUI mode. That's why we disable the systemd server service (step 8) and run SDRconnect as a desktop autostart app instead.

**WebSocket connects but returns HTTP 404 from Mac**
Use the Pi's IP address directly (e.g. `ws://192.168.1.202:5454/`) instead of the `.local` hostname. Some WebSocket libraries send a `Host` header that SDRconnect's WatsonWebsocket server doesn't recognize.

**Can't reach `swl-channel-browser.local`**
Make sure Avahi is running: `sudo systemctl status avahi-daemon`. On Windows, install [Bonjour Print Services](https://support.apple.com/kb/DL999) for `.local` resolution. Use the Pi's IP address as a fallback.

**App won't start**
Check logs: `journalctl -u swl-channel-browser -n 50`. Verify the build exists: `ls /opt/swl-channel-browser/dist/server/index.js`. Rebuild if needed: `cd /opt/swl-channel-browser && npm run build`

**High memory usage during npm install**
On a 2 GB Pi, `npm install` can spike memory. Add swap temporarily:

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
npm install
sudo swapoff /swapfile
sudo rm /swapfile
```

**Overlay filesystem is enabled but I need to make changes**
Disable the overlay via `sudo raspi-config` > Performance Options > Overlay File System > No, then reboot. Re-enable after making changes.

## Architecture

```
Phone/tablet/laptop (browser)
  |
  |--- http://swl-channel-browser.local:3000/ --> Node.js backend on Pi
  |    (web UI + schedule API)                     /opt/swl-channel-browser
  |
  |--- ws://<pi-ip>:5454/ ----------------------> SDRconnect on Pi (GUI mode)
       (tune, demod, audio, signal data)           SDRplay receiver via USB
```

## Config File Locations

| File | Purpose |
|------|---------|
| `/opt/swl-channel-browser/.env` | App configuration (port, SDRconnect host) |
| `~/.sdrconnect/config.json` | SDRconnect settings (WebSocket enabled, device config) |
| `~/.config/autostart/sdrconnect.desktop` | SDRconnect desktop autostart entry |
| `~/.config/autostart/sdrconnect-autoconnect.desktop` | xdotool auto-connect entry |
| `/boot/firmware/config.txt` | Pi display config (`hdmi_force_hotplug=1`) |
