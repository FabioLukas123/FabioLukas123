#!/usr/bin/env bash
# Enable the Claude Status Bar tray on login for the current user (Arch Linux).
#
# Sets up a systemd *user* service pointing at this checkout, and also drops an
# XDG autostart entry as a fallback for desktops without systemd integration.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PYTHON="$(command -v python3 || command -v python)"

if [[ -z "${PYTHON}" ]]; then
  echo "! python3 not found on PATH." >&2
  exit 1
fi

# --- systemd user service ----------------------------------------------------
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "${UNIT_DIR}"
cat > "${UNIT_DIR}/claude-status-bar.service" <<EOF
[Unit]
Description=Claude Status Bar tray indicator
PartOf=graphical-session.target
After=graphical-session.target

[Service]
Type=simple
ExecStart=${PYTHON} -m statusbar
WorkingDirectory=${REPO_DIR}
Environment=PYTHONPATH=${REPO_DIR}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical-session.target
EOF

# --- XDG autostart fallback --------------------------------------------------
AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
mkdir -p "${AUTOSTART_DIR}"
cat > "${AUTOSTART_DIR}/claude-status-bar.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Claude Status Bar
Comment=System-tray status indicator for Claude Code
Exec=${PYTHON} -m statusbar
Path=${REPO_DIR}
Icon=${REPO_DIR}/statusbar/assets/app.png
Terminal=false
Categories=Utility;Development;
X-GNOME-Autostart-enabled=true
EOF

echo "✓ Installed systemd user service and XDG autostart entry."

if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload || true
  systemctl --user enable --now claude-status-bar.service || \
    echo "! Could not start via systemctl --user (no graphical session?). It will start on next login."
  echo "  Manage with: systemctl --user {status,restart,stop} claude-status-bar"
fi

echo
echo "Note: on Arch you need an AppIndicator host (e.g. GNOME extension"
echo "'AppIndicator and KStatusNotifierItem Support', or it works out of the"
echo "box on KDE Plasma / XFCE) plus: pacman -S libayatana-appindicator python-gobject gtk3"
