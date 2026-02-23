# Raspberry Pi Installation Guide

Turn a Raspberry Pi 4 into a headless shortwave listening appliance. The Pi runs the SWL Channel Browser backend and connects to your SDRplay receiver over USB or your network. You access the app from any device on your LAN via `http://swl-channel-browser.local:3000`.

## What You Need

| Item | Notes |
|------|-------|
| Raspberry Pi 4 (any RAM) | 2GB is plenty for this app |
| microSD card (8GB+) | 16GB recommended |
| Power supply | Official USB-C 5.1V/3A recommended |
| Ethernet cable or WiFi | Ethernet is more reliable for a headless setup |
| SDRplay receiver | Connected via USB to the Pi, or over the network via nRSP-ST |
| Another computer | For flashing the SD card and SSH access |

## 1. Flash Raspberry Pi OS Lite

Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your computer.

1. Open Raspberry Pi Imager
2. Choose **Raspberry Pi 4** as the device
3. Choose **Raspberry Pi OS Lite (64-bit)** - the desktop environment is not needed
4. Click the gear icon (or "Edit Settings") to pre-configure:
   - **Hostname**: `swl-channel-browser`
   - **Enable SSH**: Yes (use password authentication or add your public key)
   - **Set username/password**: Pick something you'll remember (e.g. `pi` / your password)
   - **Configure WiFi**: If not using Ethernet, enter your SSID and password
   - **Locale**: Set your timezone and keyboard layout
5. Write to the SD card

Insert the SD card into the Pi and power it on. Wait about 60 seconds for first boot.

## 2. Connect via SSH

From your computer:

```bash
ssh pi@swl-channel-browser.local
```

If `.local` resolution doesn't work yet, find the Pi's IP from your router's admin page and use that instead.

## 3. Update the System

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

## 4. Install Node.js

Raspberry Pi OS Lite ships with an older Node.js. Install the current LTS (v22.x):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify:

```bash
node --version   # should show v22.x
npm --version
```

## 5. Install Git (if not already present)

```bash
sudo apt-get install -y git
```

## 6. Install SDRconnect (Headless Server)

SDRconnect is the software that controls your SDRplay receiver. The SWL Channel Browser talks to SDRconnect over WebSocket - it does not access the hardware directly. You need SDRconnect running somewhere on your network.

**Skip this step if** SDRconnect is already running on another machine or you're using an nRSP-ST (which has SDRconnect built in). Just set `SDRCONNECT_HOST` in step 8 to point to that device.

### Install the SDRplay API driver

The API driver provides low-level access to SDRplay hardware. Download the latest ARM64 `.run` installer from the [SDRplay Downloads page](https://www.sdrplay.com/downloads/):

```bash
cd ~
# Download the API installer (check sdrplay.com/downloads for the latest filename)
wget https://www.sdrplay.com/software/SDRplay_RSP_API-Linux-3.15.2.run
chmod +x SDRplay_RSP_API-Linux-3.15.2.run
sudo ./SDRplay_RSP_API-Linux-3.15.2.run
```

Follow the prompts to accept the license and install. This installs the API libraries and udev rules for RSP devices.

### Install SDRconnect

Install the required MP3 encoding library, then download the ARM64 `.run` installer from the [SDRconnect page](https://www.sdrplay.com/sdrconnect/):

```bash
sudo apt install -y libmp3lame-dev
```

```bash
# Download SDRconnect (check sdrplay.com/sdrconnect for the latest filename)
wget https://www.sdrplay.com/software/SDRconnect_linux-arm64_22b2d4724.run
chmod +x SDRconnect_linux-arm64_22b2d4724.run
sudo ./SDRconnect_linux-arm64_22b2d4724.run
```

The installer asks several questions. Answer **y** to all of them for a standard install. It will check for required dependencies, install SDRconnect to `/opt/sdrconnect`, and set it up as a background service.

Add SDRconnect to your PATH:

```bash
echo 'export PATH=/opt/sdrconnect:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Set up the SDRconnect systemd service

If the installer didn't create a service (or you want to configure it manually):

```bash
sudo tee /etc/systemd/system/sdrconnect.service > /dev/null <<EOF
[Unit]
Description=SDRconnect Server
After=network.target

[Service]
Type=simple
ExecStart=/opt/sdrconnect/SDRconnect --server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable sdrconnect
sudo systemctl start sdrconnect
```

Verify it's running:

```bash
sudo systemctl status sdrconnect
```

### Plug in your SDRplay receiver

Connect the receiver to one of the Pi's USB ports. Check that it's detected:

```bash
lsusb | grep -i sdrplay
```

You should see your device listed (e.g. "1df7:3020 SDRplay RSP1B"). If not, try a different USB port or cable.

**nRSP-ST over USB:** If you're connecting an nRSP-ST via USB rather than over the network, you may need to power-cycle the nRSP-ST while it's connected to the Pi for it to show up in `lsusb`.

> **Note:** The exact `.run` filenames change with each SDRconnect release. Always check the [SDRplay Downloads page](https://www.sdrplay.com/downloads/) for current filenames. The [SDRconnect Installation Guide (PDF)](https://www.sdrplay.com/docs/ConnectInstallGuide1.pdf) and [Raspberry Pi Tips & Tricks (PDF)](https://www.sdrplay.com/docs/RemotePiServerFinal.pdf) have additional detail.

## 7. Install the App

```bash
cd /opt
sudo git clone https://github.com/eusef/swl-channel-browser.git
sudo chown -R pi:pi /opt/swl-channel-browser
cd /opt/swl-channel-browser
npm install
```

## 8. Configure

Create the `.env` file:

```bash
cat > /opt/swl-channel-browser/.env <<EOF
PORT=3000
SDRCONNECT_HOST=127.0.0.1
SDRCONNECT_PORT=50000
EOF
```

If you installed SDRconnect on this Pi (step 6), the default `127.0.0.1` is correct.

**If SDRconnect runs on a different machine**, change `SDRCONNECT_HOST` to that machine's IP address. For example, if SDRconnect is running on `192.168.1.50`:

```
SDRCONNECT_HOST=192.168.1.50
```

**If using an nRSP-ST**, set `SDRCONNECT_HOST` to the nRSP-ST's IP address.

## 9. Build for Production

Development mode (`npm run dev`) works but uses more CPU and memory. For a headless appliance, build once and run the compiled version:

```bash
cd /opt/swl-channel-browser
npm run build
```

Test it:

```bash
npm start
```

Open `http://swl-channel-browser.local:3000` from another device on your network. If the page loads and you can browse stations, you're good. Press `Ctrl+C` to stop.

## 10. Set Up Avahi (mDNS)

Avahi lets other devices find the Pi at `swl-channel-browser.local` without knowing its IP. It's usually pre-installed on Raspberry Pi OS, but verify:

```bash
sudo apt-get install -y avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

The Pi will advertise itself using the hostname you set in step 1. From any device on your LAN, `swl-channel-browser.local` should resolve to the Pi.

To verify:

```bash
hostname
# should print: swl-channel-browser
```

If you need to change the hostname later:

```bash
sudo raspi-config
# System Options -> Hostname -> enter "swl-channel-browser"
```

## 11. Auto-Start on Boot (systemd)

Create a systemd service so the app starts automatically when the Pi powers on.

If SDRconnect is running on the same Pi, the service should start after it. If SDRconnect is on another machine, remove the `sdrconnect.service` references.

```bash
sudo tee /etc/systemd/system/swl-channel-browser.service > /dev/null <<EOF
[Unit]
Description=SWL Channel Browser
After=network-online.target sdrconnect.service
Wants=network-online.target sdrconnect.service

[Service]
Type=simple
User=pi
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

## 12. Safe Power Removal (Read-Only Filesystem)

SD cards can corrupt if the Pi loses power during a write. Enabling the overlay filesystem makes the root partition read-only with a temporary RAM overlay. Any writes go to RAM and are discarded on reboot - so the SD card is always in a clean state and safe to unplug at any time.

### Trade-offs

Before enabling, understand what this means:

| What works | What doesn't persist across reboots |
|------------|-------------------------------------|
| App runs normally | Favorites, reception log, config changes made in the UI |
| EiBi schedule loads from the pre-built copy | EiBi schedule updates (re-downloads after re-enabling writes) |
| Tuning, streaming, all real-time features | System logs, apt packages, any file changes |

The EiBi schedule CSV is included in the build at `/opt/swl-channel-browser/data/`. It will continue to work. However, any new downloads or user data written during a session will be lost on reboot.

**If you need persistent favorites and logs**, skip this section. The Pi will still work fine - just use a quality SD card and avoid yanking power while the disk activity LED is lit.

### Enable the Overlay Filesystem

1. Make sure everything is set up and working first (steps 1-11 above)
2. Run raspi-config:

```bash
sudo raspi-config
```

3. Navigate to **Performance Options** -> **Overlay File System**
4. Select **Yes** to enable the overlay filesystem
5. Select **Yes** to write-protect the boot partition
6. Reboot when prompted

The Pi is now safe to unplug at any time.

### Temporarily Disable for Updates

To update the app, install packages, or change config, you need to disable the overlay:

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

## Troubleshooting

**Can't reach `swl-channel-browser.local`**
- Make sure Avahi is running: `sudo systemctl status avahi-daemon`
- On Windows, install [Bonjour Print Services](https://support.apple.com/kb/DL999) for `.local` resolution
- Use the Pi's IP address directly as a fallback: `ssh pi@<ip-address>`

**App won't start**
- Check logs: `journalctl -u swl-channel-browser -n 50`
- Verify the build exists: `ls /opt/swl-channel-browser/dist/server/index.js`
- Rebuild if needed: `cd /opt/swl-channel-browser && npm run build`

**SDRconnect connection fails**
- Confirm `SDRCONNECT_HOST` and `SDRCONNECT_PORT` in `/opt/swl-channel-browser/.env`
- Test connectivity: `curl -s http://<sdrconnect-host>:50000` (should get a response or connection refused, not timeout)
- If SDRconnect is on another machine, make sure its firewall allows port 50000

**High memory usage**
- The `npm install` step can spike memory on a 1GB Pi. If it fails, add swap temporarily:
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
- Disable the overlay via `sudo raspi-config` -> Performance Options -> Overlay File System -> No, then reboot
