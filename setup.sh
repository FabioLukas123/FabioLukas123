#!/usr/bin/env bash
# Instalação completa em um comando:   bash setup.sh
#
# - Registra os hooks no Claude Code (~/.claude/settings.json, com backup)
# - Se você usa Waybar: injeta os módulos custom/claude + custom/codex na sua
#   config, remove o módulo "tray", aplica o CSS e recarrega a Waybar.
#   (Nesse modo NADA mais é necessário — nem tray, nem pystray/Pillow.)
# - Senão: instala as dependências do app de bandeja e ativa o autostart.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$(command -v python3 || command -v python)"
if [[ -z "${PYTHON}" ]]; then
  echo "! python3 não encontrado no PATH." >&2
  exit 1
fi

echo "==> Registrando hooks do Claude Code..."
"${PYTHON}" "${REPO_DIR}/install.py" --no-autostart

WAYBAR_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/waybar"
if [[ -d "${WAYBAR_DIR}" ]] || command -v waybar >/dev/null 2>&1; then
  echo "==> Waybar detectada — restaurando o app de bandeja original (módulo tray)..."
  "${PYTHON}" "${REPO_DIR}/packaging/waybar/install-waybar.py" --restore-tray

  # dependências do app de bandeja no python do sistema
  SYS_PY="/usr/bin/python3"; [[ -x "${SYS_PY}" ]] || SYS_PY="${PYTHON}"
  if command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --needed --noconfirm \
      python-pillow python-gobject gtk3 libayatana-appindicator || true
  fi
  "${SYS_PY}" -c "import pystray" >/dev/null 2>&1 || \
    "${SYS_PY}" -m pip install --user --quiet --break-system-packages pystray 2>/dev/null || \
    "${SYS_PY}" -m pip install --user --quiet pystray || true

  bash "${REPO_DIR}/packaging/arch/install-autostart.sh"
  echo
  echo "Tudo pronto. O ícone do Claude aparece no tray da Waybar com o menu padrão."
  exit 0
fi

echo "==> Waybar não detectada — instalando o app de bandeja..."
"${PYTHON}" -m pip install --user -q pystray Pillow || \
  "${PYTHON}" -m pip install -q pystray Pillow
if [[ "$(uname -s)" == "Linux" ]]; then
  bash "${REPO_DIR}/packaging/arch/install-autostart.sh"
fi
echo
echo "Tudo pronto. Abra uma sessão nova do Claude Code para o status aparecer."
