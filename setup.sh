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
  # o menu nativo de clique precisa dos bindings GTK; instala se faltar
  if ! "${PYTHON}" -c "import gi" >/dev/null 2>&1; then
    if command -v pacman >/dev/null 2>&1; then
      echo "==> Instalando dependências do menu nativo (python-gobject gtk3 gtk-layer-shell)..."
      sudo pacman -S --needed --noconfirm python-gobject gtk3 gtk-layer-shell || \
        echo "! Não consegui instalar via pacman; o menu de clique ficará indisponível até instalar python-gobject."
    else
      echo "! Instale python-gobject + gtk3 + gtk-layer-shell pela sua distro para o menu de clique."
    fi
  fi
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
