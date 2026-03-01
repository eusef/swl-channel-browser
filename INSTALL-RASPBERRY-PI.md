# Raspberry Pi Installation Guide

> **SDRconnect 1.0.7** added an experimental headless binary that exposes the WebSocket API (port 5454) without needing the GUI. This lets us run Raspberry Pi OS **Lite** (no desktop, no VNC, no XWayland, no xdotool). The setup is significantly simpler than previous versions.

Turn a Raspberry Pi 4 into an always-on shortwave listening appliance. The Pi runs the SWL Channel Browser backend and SDRconnect's headless binary, connecting to your SDRplay receiver over USB. You access the app from any device on your LAN via `http://swl-channel-browser.local:3000`.

## What You Need

| Item | Notes |
|------|-------|
| Raspberry Pi 4 (2 GB+ RAM) | 2 GB is fine since there's no desktop environment. 4 GB gives more headroom. |
| microSD card (16 GB+) | 32 GB recommended |
| Power supply | Official USB-C 5.1V/3A recommended |
| WiFi or Ethernet | WiFi is fine for this setup |
| SDRplay receiver | Connected via USB to the Pi (RSP1B, RSPdx-R2, RSPduo, or nRSP-ST) |
| Another computer | For flashing the SD card and SSH access |

> **nRSP-ST users:** SDRconnect 1.0.7 requires firmware 1.0.12 or later on the nRSP-ST.

## 1. Flash Raspberry Pi OS Lite (64-bit)

Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your computer.

1. Open Raspberry Pi Imager
2. Choose **Raspberry Pi 4** as the device
3. Choose **Raspberry Pi OS (64-bit)** - the **Lite** version (no desktop environment)
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

**Important:** The headless binary runs its own internal API service, so `sdrplay.service` should be disabled to avoid USB device conflicts. Stop and disable it now:

```bash
sudo systemctl stop sdrplay.service
sudo systemctl disable sdrplay.service
```

The API driver installation is still needed for the libraries and udev rules, even though we disable the daemon.

**nRSP-ST users:** The SDRplay API installer's udev rules may not include the nRSP-ST's USB product ID (`0x3040`). Check and add if missing:

```bash
grep 3040 /etc/udev/rules.d/66-sdrplay.rules
```

If nothing is returned, add the rule:

```bash
echo 'SUBSYSTEM=="usb",ENV{DEVTYPE}=="usb_device",ATTRS{idVendor}=="1df7",ATTRS{idProduct}=="3040",MODE:="0666"' | sudo tee -a /etc/udev/rules.d/66-sdrplay.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## 5. Install SDRconnect 1.0.7

Install required dependencies:

```bash
sudo apt install -y libmp3lame-dev libfontconfig1
```

`libmp3lame-dev` is for MP3 encoding. `libfontconfig1` is needed by the headless binary's SkiaSharp rendering pipeline (it will abort on startup without it).

Download the ARM64 installer from the [SDRconnect page](https://www.sdrplay.com/sdrconnect/). Transfer to Pi and run:

```bash
scp ~/Downloads/SDRconnect_linux-arm64_22b2d4724-2.run phil@swl-channel-browser.local:~/Downloads/
```

On the Pi, run the installer. Raspberry Pi OS is Debian-based (not Ubuntu), so use the `NOTSUPPORTED` flag to skip the distribution check:

```bash
chmod +x ~/Downloads/SDRconnect_linux-arm64_22b2d4724-2.run
NOTSUPPORTED=true sudo -E ~/Downloads/SDRconnect_linux-arm64_22b2d4724-2.run
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

Check what binaries were installed (we need the headless binary):

```bash
ls -la /opt/sdrconnect/
```

> **Note:** The exact `.run` filenames change with each release. Check the [SDRplay Downloads page](https://www.sdrplay.com/downloads/) for current filenames.

## 6. Configure SDRconnect Headless Service

SDRconnect 1.0.7 includes an experimental headless binary that exposes the WebSocket API (port 5454) without needing a GUI. This replaces the old approach of running the full desktop app with VNC + xdotool.

First, check if the installer already created a systemd service:

```bash
systemctl status sdrconnect.service
```

If a service exists from the installer, stop and disable it:

```bash
sudo systemctl stop sdrconnect.service
sudo systemctl disable sdrconnect.service
```

The headless binary is `/opt/sdrconnect/SDRconnect_headless`. It accepts one optional flag:

```
SDRconnect_headless [--help] [--websocket_port=<port>]
```

The default WebSocket port is 5454 (same as the GUI version). You only need `--websocket_port` if you want a different port.

The headless binary must run as **root** for USB device access. It also requires a pseudo-TTY to stay running - without one, the .NET runtime exits immediately. Wrapping with `script -qfc` inside a systemd service provides the PTY and gives you proper service management (auto-restart, logging via `journalctl`):

```bash
sudo tee /etc/systemd/system/sdrconnect-headless.service > /dev/null <<'EOF'
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
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sdrconnect-headless
sudo systemctl start sdrconnect-headless
```

The 15-second delay ensures the USB device is fully initialized. `Restart=always` handles the case where the binary exits on first boot before USB is ready - systemd restarts it after 10 seconds and it succeeds on the next attempt.

Check that port 5454 is listening:

```bash
ss -tlnp | grep 5454
```

Port 5454 should be listening on `127.0.0.1`, `127.0.1.1`, and your LAN IP.

## 7. Create Device Selection Service

The headless binary does not auto-connect to the SDR device on launch. A separate oneshot systemd service selects the first available device via the WebSocket API after the headless binary is ready.

> **Critical: `perMessageDeflate` must be disabled.** SDRconnect's WatsonWebsocket server rejects WebSocket connections that include the `permessage-deflate` extension header (returns HTTP 404). All WebSocket clients must connect with compression disabled.

This service waits for port 5454 to be listening, then sends the `selected_device` command using Node.js (installed in step 9, but listed here for reference since it runs on boot):

```bash
sudo tee /etc/systemd/system/sdrconnect-device-select.service > /dev/null <<'EOF'
[Unit]
Description=Select SDR device on SDRconnect headless
After=sdrconnect-headless.service
Requires=sdrconnect-headless.service

[Service]
Type=oneshot
ExecStartPre=/bin/bash -c 'stable=0; for i in $(seq 1 90); do if ss -tlnp | grep -q 5454; then stable=$((stable+1)); [ $stable -ge 5 ] && exit 0; else stable=0; fi; sleep 1; done; exit 1'
ExecStart=/usr/bin/node -e "const WS=require('/opt/swl-channel-browser/node_modules/ws');const ws=new WS('ws://127.0.0.1:5454/',{perMessageDeflate:false});ws.on('open',()=>{ws.send(JSON.stringify({event_type:'selected_device',value:'0'}));setTimeout(()=>ws.close(),3000);});ws.on('error',()=>process.exit(1));"
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sdrconnect-device-select
```

> **Note:** This service depends on the `ws` npm module from the app (step 11). If you're following the steps in order, come back and enable this service after completing step 11.

To select a specific device by serial number instead of index, replace `selected_device` with `selected_device_serial` and set the value to your device's serial (find it with `lsusb -v -d 1df7: 2>/dev/null | grep iSerial`).

## 8. Verify SDRconnect Setup

After completing steps 9-11, reboot to test the full stack:

```bash
sudo reboot
```

Wait ~30 seconds, then verify from the Pi via SSH:

```bash
cd /opt/swl-channel-browser && node -e "
const WS = require('ws');
const ws = new WS('ws://127.0.0.1:5454/', { perMessageDeflate: false });
ws.on('open', () => {
  ws.send(JSON.stringify({event_type:'get_property',property:'started'}));
});
ws.on('message', (d) => { console.log(d.toString()); process.exit(); });
ws.on('error', (e) => { console.log('ERROR:', e.message); process.exit(1); });
setTimeout(() => process.exit(1), 5000);
"
```

Expected output:

```json
{
  "event_type": "get_property_response",
  "property": "started",
  "value": "true"
}
```

If `started` is `"false"`, restart the device selection service: `sudo systemctl restart sdrconnect-device-select`. Check its logs: `journalctl -u sdrconnect-device-select -n 20`

## 9. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node --version   # should show v22.x
npm --version
```

## 10. Install Git (if not already present)

```bash
sudo apt install -y git
```

## 11. Install the App

```bash
cd /opt
sudo git clone https://github.com/eusef/swl-channel-browser.git
sudo chown -R $(whoami):$(whoami) /opt/swl-channel-browser
cd /opt/swl-channel-browser
npm install
```

## 12. Configure

Create the `.env` file:

```bash
cat > /opt/swl-channel-browser/.env <<EOF
PORT=3000
SDRCONNECT_HOST=127.0.0.1
SDRCONNECT_PORT=5454
EOF
```

If SDRconnect is running on this Pi (steps 4-8), the default `127.0.0.1` is correct.

**If SDRconnect runs on a different machine**, change `SDRCONNECT_HOST` to that machine's IP address.

## 13. Build for Production

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

## 14. Auto-Start the App on Boot (systemd)

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

## 15. Set Up Avahi (mDNS)

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

## 16. Safe Power Removal (Read-Only Filesystem) - Optional

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

1. Make sure everything is set up and working first (steps 1-15)
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
| SSH | 22 | TCP | Remote terminal access |

## Verification Checklist

| Check | How to verify | Expected |
|-------|---------------|----------|
| SSH access | `ssh phil@swl-channel-browser.local` | Login succeeds |
| Headless binary running | `ss -tlnp \| grep 5454` (on Pi) | Listening on LAN IP |
| Device selected | `systemctl status sdrconnect-device-select` (on Pi) | `active (exited)` with status=0 |
| Port 5454 open | `ss -tlnp \| grep 5454` (on Pi) | Listening on LAN IP |
| WebSocket responds | Node.js test from step 8 | `started: true` |
| Signal data streaming | Connect WebSocket and listen | `signal_power` and `signal_snr` events every ~500ms |
| App accessible | Open `http://swl-channel-browser.local:3000` in browser | Station list loads, green "Connected" indicator |
| Survives reboot | Power cycle Pi, wait 30s, test WebSocket + app | Everything works without manual intervention |

## Troubleshooting

**Headless binary aborts immediately with `TypeInitializationException` / `DllNotFoundException: libSkiaSharp`**
Two possible causes:
1. Missing `libfontconfig1`: Install with `sudo apt install -y libfontconfig1`
2. Missing library path: Run with `LD_LIBRARY_PATH=/opt/sdrconnect` (the systemd service handles this automatically)

**SDRconnect crashes with `DllNotFoundException: swig_bindings`**
The installer sets `.so` files to root-only permissions. Fix: `sudo chmod 755 /opt/sdrconnect/*.so`

**WebSocket clients get HTTP 404 even though port 5454 is listening**
SDRconnect's WatsonWebsocket server rejects connections that include the `permessage-deflate` extension header. All WebSocket clients must connect with compression disabled: `new WebSocket(url, { perMessageDeflate: false })` in Node.js, or equivalent in other libraries.

**Port 5454 not listening at all**
Check that the headless binary is running: `ps aux | grep SDRconnect_headless`. Check the log: `cat /var/log/sdrconnect-headless.log`. Verify the cron job exists: `sudo crontab -l`. If the binary isn't running, start it manually: `sudo bash -c 'cd /opt/sdrconnect && LD_LIBRARY_PATH=/opt/sdrconnect /opt/sdrconnect/SDRconnect_headless &'`

**Port 5454 only on localhost (127.0.0.1), not on LAN IP**
The headless binary must be launched from `/opt/sdrconnect/` directory. The systemd service sets `WorkingDirectory=/opt/sdrconnect` to handle this.

**SDR device not connected after boot (frequency = 0)**
The device may need to be opened via WebSocket API after the headless binary starts. Check the startup script logs and adjust the sleep delay if needed.

**SDR device not detected by SDRconnect**
The USB device may not be ready at boot. Try physically disconnecting and reconnecting the USB cable. Also check that your device's USB product ID is included in `/etc/udev/rules.d/66-sdrplay.rules` (the nRSP-ST `0x3040` may be missing). If `journalctl -u sdrconnect-headless` shows `libusb_open() -3`, this is a USB permissions issue - fix the udev rules (see step 4).

**Installer fails with distribution check error**
Raspberry Pi OS is Debian-based, not Ubuntu. Use the `NOTSUPPORTED=true` flag: `NOTSUPPORTED=true sudo -E ./SDRconnect_linux-arm64_22b2d4724-2.run`

**WebSocket connects but returns HTTP 404 from Mac/remote machine**
This is almost always caused by `perMessageDeflate` (WebSocket compression) being enabled. SDRconnect's WatsonWebsocket server rejects connections with the `permessage-deflate` extension. Disable compression in your WebSocket client. If using the Pi's IP directly doesn't help, compression is the issue.

**Can't reach `swl-channel-browser.local`**
Make sure Avahi is running: `sudo systemctl status avahi-daemon`. On Windows, install [Bonjour Print Services](https://support.apple.com/kb/DL999) for `.local` resolution. Use the Pi's IP address as a fallback.

**`.local` hostname changed to `hostname-2.local` after reboot**
If another device on your network shares the same hostname, Avahi will detect a conflict and automatically append `-2` (e.g. `swl-channel-browser-2.local`). Check with `sudo systemctl status avahi-daemon` and look for "Host name conflict, retrying with..." in the logs. Fix by either renaming the conflicting device or choosing a unique hostname for the Pi: `sudo hostnamectl set-hostname <new-name>` then `sudo reboot`.

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
  |--- ws://<pi-ip>:5454/ ----------------------> SDRconnect headless on Pi
       (tune, demod, audio, signal data)           SDRplay receiver via USB
```

## Config File Locations

| File | Purpose |
|------|---------|
| `/opt/swl-channel-browser/.env` | App configuration (port, SDRconnect host) |
| `/root/.sdrconnect/config.json` | SDRconnect settings (device config, runs as root) |
| `/etc/systemd/system/sdrconnect-headless.service` | Headless binary systemd service |
| `/etc/systemd/system/sdrconnect-device-select.service` | Device selection oneshot service |
| `/etc/udev/rules.d/66-sdrplay.rules` | USB device permissions for SDRplay hardware |
