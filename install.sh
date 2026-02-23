#!/usr/bin/env bash
# SWL Channel Browser - Mac/Linux Quick Install
# Run: bash install.sh

set -e

# Detect OS
OS="$(uname -s)"

# Install Git and Node.js if missing
install_deps() {
  if command -v git &>/dev/null && command -v node &>/dev/null; then
    echo "Git and Node.js already installed."
    return
  fi

  case "$OS" in
    Darwin)
      if ! command -v brew &>/dev/null; then
        echo "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      fi
      command -v git &>/dev/null || brew install git
      command -v node &>/dev/null || brew install node
      ;;
    Linux)
      if command -v apt-get &>/dev/null; then
        sudo apt-get update
        command -v git &>/dev/null || sudo apt-get install -y git
        if ! command -v node &>/dev/null; then
          curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
          sudo apt-get install -y nodejs
        fi
      elif command -v dnf &>/dev/null; then
        command -v git &>/dev/null || sudo dnf install -y git
        if ! command -v node &>/dev/null; then
          curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
          sudo dnf install -y nodejs
        fi
      else
        echo "Unsupported package manager. Install Git and Node.js 18+ manually, then re-run this script."
        exit 1
      fi
      ;;
    *)
      echo "Unsupported OS: $OS"
      exit 1
      ;;
  esac
}

install_deps

# Clone and set up
git clone https://github.com/eusef/swl-channel-browser.git
cd swl-channel-browser
npm install

# Create .env with defaults
cat > .env <<EOF
PORT=3000
SDRCONNECT_HOST=127.0.0.1
SDRCONNECT_PORT=5454
EOF

echo ""
echo "Done! Run 'npm run dev' to start the app."
echo "Then open http://localhost:5173 in your browser."
