# SWL Channel Browser - Windows Quick Install
# Paste this into PowerShell (Run as Administrator)

# Allow scripts to run (once per user, survives reboots)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

# Install Git
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements

# Install Node.js
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements

# Refresh PATH so git and node are available
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# Clone and set up
git clone https://github.com/eusef/swl-channel-browser.git
cd swl-channel-browser
npm install

# Create .env with defaults
@"
PORT=3000
SDRCONNECT_HOST=127.0.0.1
SDRCONNECT_PORT=5454
"@ | Out-File -Encoding utf8 .env

Write-Host ""
Write-Host "Done! Run 'npm run dev' to start the app." -ForegroundColor Green
Write-Host "Then open http://localhost:5173 in your browser." -ForegroundColor Green
Write-Host ""
Write-Host "NOTE: On first run, Windows Firewall will ask to allow Node.js." -ForegroundColor Yellow
Write-Host "Click 'Allow access' so other devices on your network can connect." -ForegroundColor Yellow
