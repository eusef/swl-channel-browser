#!/usr/bin/env bash
# ============================================================================
# SWL Channel Browser - Raspberry Pi Installation Script
# ============================================================================
# Automates steps 3-15 from INSTALL-RASPBERRY-PI.md
#
# Prerequisites (manual steps before running this script):
#   1. Flash Raspberry Pi OS Lite (64-bit) with SSH enabled
#   2. SSH into the Pi
#   3. Transfer SDRplay API .run and SDRconnect .run installers to ~/Downloads/
#
# Usage:
#   bash install-pi.sh
#
# The script will pause at interactive installers (SDRplay API, SDRconnect)
# and resume automatically after each one completes.
# ============================================================================

set -uo pipefail
# Note: We intentionally do NOT use set -e (errexit) here.
# Many commands in this script (crontab -l, grep -q, systemctl is-enabled)
# return non-zero exit codes as normal flow control. With set -e and pipefail
# combined, these cause silent script death. Instead, we check return codes
# explicitly where failure matters and use the fail() helper to abort.

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
APP_DIR="/opt/swl-channel-browser"
SDR_DIR="/opt/sdrconnect"
HEADLESS_BIN="${SDR_DIR}/SDRconnect_headless"
REPO_URL="https://github.com/eusef/swl-channel-browser.git"
NODE_MAJOR=22
LOG_FILE="/var/log/sdrconnect-headless.log"
BOOT_DELAY=15

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# Big visual banner for moments that need user attention
user_action_banner() {
  local title="$1"
  shift
  local width=64
  local border=$(printf '=%.0s' $(seq 1 $width))
  echo ""
  echo -e "${YELLOW}${border}${NC}"
  echo -e "${YELLOW}||${NC}"
  echo -e "${YELLOW}||  ${GREEN}${title}${NC}"
  echo -e "${YELLOW}||${NC}"
  for line in "$@"; do
    echo -e "${YELLOW}||${NC}  ${line}"
  done
  echo -e "${YELLOW}||${NC}"
  echo -e "${YELLOW}${border}${NC}"
  echo ""
}

prompt_continue() {
  echo ""
  read -rp "Press Enter to continue (or Ctrl+C to abort)..."
  echo ""
}

# Safe file search - case-insensitive, returns empty string instead of failing
find_installer() {
  local dir="$1"
  local pattern="$2"
  local result=""
  if [[ -d "$dir" ]]; then
    result=$(find "$dir" -maxdepth 1 -iname "$pattern" 2>/dev/null | sort -V | tail -1 || true)
  fi
  echo "$result"
}

check_root() {
  if [[ $EUID -eq 0 ]]; then
    fail "Don't run this script as root. Run as your normal user (it will use sudo when needed)."
  fi
}

check_pi() {
  if [[ ! -f /proc/device-tree/model ]]; then
    warn "Can't detect Raspberry Pi model. Continuing anyway..."
    return
  fi
  local model
  model=$(tr -d '\0' < /proc/device-tree/model)
  info "Detected: ${model}"
}

check_arch() {
  local arch
  arch=$(uname -m)
  if [[ "$arch" != "aarch64" ]]; then
    fail "This script requires 64-bit ARM (aarch64). Detected: ${arch}"
  fi
  ok "Architecture: aarch64"
}

# ---------------------------------------------------------------------------
# Step 3: System Update
# ---------------------------------------------------------------------------
step_system_update() {
  info "Step 3: Updating system packages..."
  sudo apt update || fail "apt update failed"
  info "Upgrading installed packages (this may take a few minutes)..."
  sudo apt upgrade -y || fail "apt upgrade failed"
  ok "System updated and upgraded"
}

# ---------------------------------------------------------------------------
# Step 4: SDRplay API Driver
# ---------------------------------------------------------------------------
step_sdrplay_api() {
  info "Step 4: Installing SDRplay API driver..."

  # Ensure ~/Downloads exists
  mkdir -p ~/Downloads

  # Find the .run installer
  local api_installer=""
  api_installer=$(find_installer ~/Downloads 'SDRplay_RSP_API*.run')

  if [[ -z "$api_installer" ]]; then
    echo ""
    warn "SDRplay API installer (.run file) not found in ~/Downloads/"
    echo ""
    echo "  This file is required. To get it:"
    echo ""
    echo "  1. On your computer, download the ARM64 .run installer from:"
    echo "     https://www.sdrplay.com/api/"
    echo ""
    echo "  2. Transfer it to this Pi (run this from your computer):"
    echo "     scp ~/Downloads/SDRplay_RSP_API-Linux-3.15.2.run $(whoami)@$(hostname).local:~/Downloads/"
    echo ""
    echo "  Expected filename pattern: SDRplay_RSP_API*.run (e.g. SDRplay_RSP_API-Linux-3.15.2.run)"
    echo ""
    echo "  You can do this now in another terminal and press Enter when ready,"
    echo "  or type a full path if the file is somewhere else on this Pi."
    echo ""
    read -rp "Path to installer (or Enter to re-scan ~/Downloads): " custom_path
    if [[ -n "${custom_path:-}" ]]; then
      api_installer="$custom_path"
      if [[ ! -f "$api_installer" ]]; then
        fail "File not found: ${api_installer}"
      fi
    else
      api_installer=$(find_installer ~/Downloads 'SDRplay_RSP_API*.run')
    fi
    if [[ -z "$api_installer" ]]; then
      echo ""
      fail "SDRplay API installer not found. Please transfer it to ~/Downloads/ and re-run this script."
    fi
  fi

  info "Found: ${api_installer}"
  chmod +x "$api_installer"

  user_action_banner \
    "ACTION REQUIRED: SDRplay API Installer" \
    "The SDRplay API installer is about to launch." \
    "It will ask you several questions interactively." \
    "" \
    "What to do:" \
    "  - Read and accept the license agreement" \
    "  - Answer ${GREEN}y${NC} (yes) to all prompts to use default options" \
    "  - The installer will finish on its own" \
    "" \
    "The install script will resume automatically when done."

  read -rp "Press Enter to launch the SDRplay API installer..."
  echo ""
  sudo "$api_installer" || fail "SDRplay API installer exited with an error"
  ok "SDRplay API installed"

  # Disable sdrplay.service (headless binary runs its own)
  info "Disabling sdrplay.service (headless binary has its own internal API)..."
  sudo systemctl stop sdrplay.service 2>/dev/null || true
  sudo systemctl disable sdrplay.service 2>/dev/null || true
  ok "sdrplay.service disabled"

  # Check udev rules for nRSP-ST (0x3040)
  if [[ -f /etc/udev/rules.d/66-sdrplay.rules ]]; then
    if ! grep -q "3040" /etc/udev/rules.d/66-sdrplay.rules; then
      info "Adding nRSP-ST (0x3040) to udev rules..."
      echo 'SUBSYSTEM=="usb",ENV{DEVTYPE}=="usb_device",ATTRS{idVendor}=="1df7",ATTRS{idProduct}=="3040",MODE:="0666"' | sudo tee -a /etc/udev/rules.d/66-sdrplay.rules
      sudo udevadm control --reload-rules && sudo udevadm trigger
      ok "nRSP-ST udev rule added"
    else
      ok "nRSP-ST udev rule already present"
    fi
  else
    warn "udev rules file not found at /etc/udev/rules.d/66-sdrplay.rules"
    warn "The API installer may not have created it. Check manually."
  fi
}

# ---------------------------------------------------------------------------
# Step 5: SDRconnect 1.0.7
# ---------------------------------------------------------------------------
step_sdrconnect() {
  info "Step 5: Installing SDRconnect..."

  # Install dependencies
  info "Installing dependencies (libmp3lame-dev, libfontconfig1)..."
  sudo apt install -y libmp3lame-dev libfontconfig1

  # Find the .run installer
  local sdr_installer=""
  sdr_installer=$(find_installer ~/Downloads 'SDRconnect*.run')

  if [[ -z "$sdr_installer" ]]; then
    echo ""
    warn "SDRconnect installer (.run file) not found in ~/Downloads/"
    echo ""
    echo "  This file is required. To get it:"
    echo ""
    echo "  1. On your computer, download the ARM64 installer from:"
    echo "     https://www.sdrplay.com/sdrconnect/"
    echo ""
    echo "  2. Transfer it to this Pi (run this from your computer):"
    echo "     scp ~/Downloads/SDRconnect_linux-arm64_22b2d4724-2.run $(whoami)@$(hostname).local:~/Downloads/"
    echo ""
    echo "  Expected filename pattern: SDRconnect*.run (e.g. SDRconnect_linux-arm64_22b2d4724-2.run)"
    echo ""
    echo "  You can do this now in another terminal and press Enter when ready,"
    echo "  or type a full path if the file is somewhere else on this Pi."
    echo ""
    read -rp "Path to installer (or Enter to re-scan ~/Downloads): " custom_path
    if [[ -n "${custom_path:-}" ]]; then
      sdr_installer="$custom_path"
      if [[ ! -f "$sdr_installer" ]]; then
        fail "File not found: ${sdr_installer}"
      fi
    else
      sdr_installer=$(find_installer ~/Downloads 'SDRconnect*.run')
    fi
    if [[ -z "$sdr_installer" ]]; then
      echo ""
      fail "SDRconnect installer not found. Please transfer it to ~/Downloads/ and re-run this script."
    fi
  fi

  info "Found: ${sdr_installer}"
  chmod +x "$sdr_installer"

  user_action_banner \
    "ACTION REQUIRED: SDRconnect Installer" \
    "The SDRconnect installer is about to launch." \
    "It will ask you several questions interactively." \
    "" \
    "What to do:" \
    "  - Read and accept the license agreement" \
    "  - Answer ${GREEN}y${NC} (yes) to all prompts to use default options" \
    "  - The installer will finish on its own" \
    "" \
    "Note: The Ubuntu distribution check is bypassed automatically" \
    "      (Raspberry Pi OS is Debian-based, which is fine)." \
    "" \
    "The install script will resume automatically when done."

  read -rp "Press Enter to launch the SDRconnect installer..."
  echo ""
  NOTSUPPORTED=true sudo -E "$sdr_installer" || fail "SDRconnect installer exited with an error"
  ok "SDRconnect installed"

  # Fix .so permissions
  info "Fixing shared library permissions..."
  sudo chmod 755 "${SDR_DIR}"/*.so
  ok "Library permissions fixed"

  # Verify headless binary exists
  if [[ -f "$HEADLESS_BIN" ]]; then
    ok "Headless binary found: ${HEADLESS_BIN}"
  else
    fail "Headless binary not found at ${HEADLESS_BIN}. Check the SDRconnect installation."
  fi

  # Disable any installer-created sdrconnect.service
  if systemctl list-unit-files | grep -q sdrconnect.service; then
    info "Disabling installer-created sdrconnect.service..."
    sudo systemctl stop sdrconnect.service 2>/dev/null || true
    sudo systemctl disable sdrconnect.service 2>/dev/null || true
    ok "sdrconnect.service disabled"
  fi

  # Add to PATH
  if ! grep -q '/opt/sdrconnect' ~/.bashrc; then
    echo 'export PATH=/opt/sdrconnect:$PATH' >> ~/.bashrc
    ok "Added /opt/sdrconnect to PATH in .bashrc"
  fi
}

# ---------------------------------------------------------------------------
# Step 6: SDRconnect Headless - systemd service
# ---------------------------------------------------------------------------
step_headless_service() {
  info "Step 6: Setting up headless binary as a systemd service..."

  # Remove any leftover cron entries from previous installs
  if sudo crontab -l 2>/dev/null | grep -q "SDRconnect_headless"; then
    info "Removing old cron @reboot entry (replaced by systemd service)..."
    sudo crontab -l 2>/dev/null | grep -v "SDRconnect_headless" | sudo crontab -
  fi

  # The headless binary requires a pseudo-TTY to stay running.
  # 'script -qfc' provides one. Restart=always handles the case where
  # the binary exits cleanly on first boot attempt before USB is ready.
  sudo tee /etc/systemd/system/sdrconnect-headless.service > /dev/null <<SVCEOF
[Unit]
Description=SDRconnect Headless
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Environment=HOME=/root
Environment=TERM=xterm-256color
Environment=LD_LIBRARY_PATH=${SDR_DIR}
WorkingDirectory=${SDR_DIR}
ExecStartPre=/bin/sleep ${BOOT_DELAY}
ExecStart=/usr/bin/script -qfc './SDRconnect_headless' /dev/null
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

  sudo systemctl daemon-reload
  sudo systemctl enable sdrconnect-headless
  ok "SDRconnect headless systemd service created and enabled"

  # Start it now
  info "Starting headless binary now..."
  sudo systemctl start sdrconnect-headless

  # Wait for port 5454
  info "Waiting for port 5454 to come up (up to 60 seconds)..."
  local count=0
  while ! ss -tlnp 2>/dev/null | grep -q ":5454 "; do
    sleep 1
    count=$((count + 1))
    if [[ $count -ge 60 ]]; then
      warn "Port 5454 did not come up within 60 seconds."
      warn "Check logs: journalctl -u sdrconnect-headless"
      warn "Continuing anyway - it may start after a restart cycle."
      return
    fi
  done
  ok "Port 5454 is listening (took ${count}s)"
}

# ---------------------------------------------------------------------------
# Step 9: Node.js
# ---------------------------------------------------------------------------
step_nodejs() {
  info "Step 9: Installing Node.js ${NODE_MAJOR}..."

  if command -v node &>/dev/null; then
    local current_ver
    current_ver=$(node --version)
    ok "Node.js already installed: ${current_ver}"
    return
  fi

  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash - || fail "NodeSource setup failed"
  sudo apt install -y nodejs || fail "Node.js install failed"
  ok "Node.js installed: $(node --version)"
}

# ---------------------------------------------------------------------------
# Step 10: Git
# ---------------------------------------------------------------------------
step_git() {
  info "Step 10: Installing Git..."

  if command -v git &>/dev/null; then
    ok "Git already installed: $(git --version)"
    return
  fi

  sudo apt install -y git || fail "Git install failed"
  ok "Git installed: $(git --version)"
}

# ---------------------------------------------------------------------------
# Step 11: Clone and install the app
# ---------------------------------------------------------------------------
step_app_install() {
  info "Step 11: Installing SWL Channel Browser..."

  if [[ -d "$APP_DIR" ]]; then
    warn "${APP_DIR} already exists."
    read -rp "Pull latest and reinstall? (y/n): " answer
    if [[ "$answer" == "y" ]]; then
      cd "$APP_DIR"
      git pull
      npm install
      ok "App updated"
    else
      ok "Skipping clone, using existing installation"
    fi
  else
    cd /opt
    sudo git clone "$REPO_URL" || fail "Git clone failed"
    sudo chown -R "$(whoami):$(whoami)" "$APP_DIR"
    cd "$APP_DIR"
    npm install || fail "npm install failed"
    ok "App installed"
  fi
}

# ---------------------------------------------------------------------------
# Step 12: .env config
# ---------------------------------------------------------------------------
step_env_config() {
  info "Step 12: Creating .env configuration..."

  if [[ -f "${APP_DIR}/.env" ]]; then
    warn ".env already exists:"
    cat "${APP_DIR}/.env"
    echo ""
    read -rp "Overwrite with defaults? (y/n): " answer
    [[ "$answer" != "y" ]] && { ok "Keeping existing .env"; return; }
  fi

  cat > "${APP_DIR}/.env" <<EOF
PORT=3000
SDRCONNECT_HOST=127.0.0.1
SDRCONNECT_PORT=5454
EOF
  ok ".env created"
}

# ---------------------------------------------------------------------------
# Step 13: Build for production
# ---------------------------------------------------------------------------
step_build() {
  info "Step 13: Building for production..."
  cd "$APP_DIR"
  npm run build || fail "Production build failed"
  ok "Production build complete"
}

# ---------------------------------------------------------------------------
# Step 7: Device selection service
# (Placed after step 11 so the ws module is available)
# ---------------------------------------------------------------------------
step_device_select_service() {
  info "Step 7: Creating device selection oneshot service..."

  # The headless binary may start, exit, and restart on first boot (USB not ready).
  # The port-poll waits for 5454 to be up for 5 consecutive seconds before selecting,
  # ensuring we don't select during the first (doomed) attempt.
  sudo tee /etc/systemd/system/sdrconnect-device-select.service > /dev/null <<'SVCEOF'
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
SVCEOF

  sudo systemctl daemon-reload
  sudo systemctl enable sdrconnect-device-select
  ok "Device selection service created and enabled"

  # Try to run it now if port 5454 is up
  if ss -tlnp 2>/dev/null | grep -q ":5454 "; then
    info "Selecting device now..."
    sudo systemctl start sdrconnect-device-select
    if systemctl is-active --quiet sdrconnect-device-select; then
      ok "Device selected successfully"
    else
      warn "Device selection may have failed. Check: journalctl -u sdrconnect-device-select"
    fi
  else
    warn "Port 5454 not up yet. Device will be selected on next boot."
  fi
}

# ---------------------------------------------------------------------------
# Step 14: App systemd service
# ---------------------------------------------------------------------------
step_app_service() {
  info "Step 14: Creating SWL Channel Browser systemd service..."

  local current_user
  current_user=$(whoami)

  sudo tee /etc/systemd/system/swl-channel-browser.service > /dev/null <<EOF
[Unit]
Description=SWL Channel Browser
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${current_user}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable swl-channel-browser
  sudo systemctl start swl-channel-browser
  ok "SWL Channel Browser service created and started"
}

# ---------------------------------------------------------------------------
# Step 15: Avahi (mDNS)
# ---------------------------------------------------------------------------
step_avahi() {
  info "Step 15: Configuring Avahi (mDNS)..."

  sudo apt install -y avahi-daemon
  sudo systemctl enable avahi-daemon
  sudo systemctl start avahi-daemon

  local hostname_val
  hostname_val=$(hostname)
  ok "Avahi running. This Pi is reachable at: ${hostname_val}.local"
}

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------
step_verify() {
  info "Running verification checks..."
  echo ""

  local pass=0
  local total=0

  # Check headless binary
  total=$((total + 1))
  if [[ -f "$HEADLESS_BIN" ]]; then
    ok "Headless binary exists"
    pass=$((pass + 1))
  else
    warn "Headless binary not found"
  fi

  # Check port 5454
  total=$((total + 1))
  if ss -tlnp 2>/dev/null | grep -q ":5454 "; then
    ok "Port 5454 is listening"
    pass=$((pass + 1))
  else
    warn "Port 5454 is not listening"
  fi

  # Check headless service
  total=$((total + 1))
  if systemctl is-enabled --quiet sdrconnect-headless 2>/dev/null; then
    ok "SDRconnect headless service is enabled"
    pass=$((pass + 1))
  else
    warn "SDRconnect headless service is not enabled"
  fi

  # Check sdrplay.service disabled
  total=$((total + 1))
  if ! systemctl is-enabled --quiet sdrplay.service 2>/dev/null; then
    ok "sdrplay.service is disabled"
    pass=$((pass + 1))
  else
    warn "sdrplay.service is still enabled (should be disabled)"
  fi

  # Check device-select service
  total=$((total + 1))
  if systemctl is-enabled --quiet sdrconnect-device-select 2>/dev/null; then
    ok "Device selection service is enabled"
    pass=$((pass + 1))
  else
    warn "Device selection service is not enabled"
  fi

  # Check app service
  total=$((total + 1))
  if systemctl is-active --quiet swl-channel-browser 2>/dev/null; then
    ok "SWL Channel Browser service is running"
    pass=$((pass + 1))
  else
    warn "SWL Channel Browser service is not running"
  fi

  # Check port 3000
  total=$((total + 1))
  if ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    ok "Port 3000 is listening"
    pass=$((pass + 1))
  else
    warn "Port 3000 is not listening"
  fi

  # Check Avahi
  total=$((total + 1))
  if systemctl is-active --quiet avahi-daemon 2>/dev/null; then
    ok "Avahi is running"
    pass=$((pass + 1))
  else
    warn "Avahi is not running"
  fi

  # WebSocket test
  total=$((total + 1))
  if ss -tlnp 2>/dev/null | grep -q ":5454 "; then
    local ws_result
    ws_result=$(cd "$APP_DIR" && timeout 10 node -e "
const WS = require('ws');
const ws = new WS('ws://127.0.0.1:5454/', { perMessageDeflate: false });
ws.on('open', () => {
  ws.send(JSON.stringify({event_type:'get_property',property:'started'}));
});
ws.on('message', (d) => { console.log(d.toString()); process.exit(); });
ws.on('error', (e) => { console.log('ERROR:', e.message); process.exit(1); });
setTimeout(() => process.exit(1), 5000);
" 2>&1 || true)

    if echo "$ws_result" | grep -q '"started"'; then
      local started_val
      started_val=$(echo "$ws_result" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).value)}catch(e){console.log('unknown')}})" 2>/dev/null || echo "unknown")
      if [[ "$started_val" == "true" ]]; then
        ok "WebSocket API responds - device is streaming"
      else
        warn "WebSocket API responds - device NOT streaming (started=${started_val})"
        warn "  Try: sudo systemctl restart sdrconnect-device-select"
      fi
      pass=$((pass + 1))
    else
      warn "WebSocket API did not respond as expected"
    fi
  else
    warn "Skipping WebSocket test (port 5454 not up)"
  fi

  echo ""
  echo "========================================"
  echo "  Verification: ${pass}/${total} checks passed"
  echo "========================================"
  echo ""

  local hostname_val
  hostname_val=$(hostname)
  if [[ $pass -eq $total ]]; then
    ok "Installation complete!"
  else
    warn "Some checks failed. Review warnings above."
  fi

  echo ""
  info "Access the app at: http://${hostname_val}.local:3000"
  info "To test reboot resilience: sudo reboot"
  info "After reboot, wait ~30s then check the app again."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo ""
  echo "========================================================"
  echo "  SWL Channel Browser - Raspberry Pi Installer"
  echo "========================================================"
  echo ""
  echo "This script automates steps 3-15 of INSTALL-RASPBERRY-PI.md"
  echo ""
  echo "Before running, make sure you have:"
  echo "  1. Flashed Pi OS Lite (64-bit) and can SSH in"
  echo "  2. Placed these files in ~/Downloads/ on the Pi:"
  echo "     - SDRplay_RSP_API*.run  (e.g. SDRplay_RSP_API-Linux-3.15.2.run)"
  echo "     - SDRconnect*.run       (e.g. SDRconnect_linux-arm64_22b2d4724-2.run)"
  echo "  3. SDRplay receiver plugged into USB"
  echo ""

  check_root
  check_pi
  check_arch

  prompt_continue

  step_system_update        # Step 3
  step_sdrplay_api          # Step 4
  step_sdrconnect           # Step 5
  step_nodejs               # Step 9 (before step 6 needs ws module path)
  step_git                  # Step 10
  step_app_install          # Step 11
  step_env_config           # Step 12
  step_build                # Step 13
  step_headless_service     # Step 6 (after build so ws module exists)
  step_device_select_service # Step 7
  step_app_service          # Step 14
  step_avahi                # Step 15

  step_verify               # Final checks

  echo ""
  info "Optional: Enable read-only filesystem for safe power removal"
  info "  sudo raspi-config > Performance Options > Overlay File System"
  echo ""
}

main "$@"
