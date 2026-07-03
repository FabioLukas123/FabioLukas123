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
  echo "==> Waybar detectada — configurando módulos (sem tray)..."
  "${PYTHON}" "${REPO_DIR}/packaging/waybar/install-waybar.py"
  # O menu nativo precisa dos bindings GTK NO PYTHON DO SISTEMA (o pacman só
  # instala lá; pyenv/conda/venv não os enxergam).
  GTK_PY="/usr/bin/python3"; [[ -x "${GTK_PY}" ]] || GTK_PY="${PYTHON}"
  MISSING=""
  "${GTK_PY}" -c "import gi" >/dev/null 2>&1 || MISSING="python-gobject gtk3 gtk-layer-shell"
  if [[ -z "${MISSING}" ]]; then
    "${GTK_PY}" -c "import gi; gi.require_version('GtkLayerShell','0.1')" >/dev/null 2>&1 || \
      MISSING="gtk-layer-shell"
  fi
  if [[ -n "${MISSING}" ]]; then
    if command -v pacman >/dev/null 2>&1; then
      echo "==> Instalando dependências do menu nativo (${MISSING})..."
      sudo pacman -S --needed --noconfirm ${MISSING} || \
        echo "! pacman falhou; diagnóstico: ${GTK_PY} -m statusbar --menu-debug"
    else
      echo "! Instale pela sua distro: ${MISSING}"
    fi
  fi
  echo "==> Diagnóstico do menu:"
  PYTHONPATH="${REPO_DIR}" "${GTK_PY}" -m statusbar --menu-debug 2>&1 | sed 's/^/    /' || true
  echo
  echo "Tudo pronto. Abra uma sessão nova do Claude Code e o 🦀 aparece na barra."
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
