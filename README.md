# Claude Status Bar — Arch (Waybar) & Windows

Status do Claude Code na barra, com o Clawd 🦀:

- ocioso = pose escolhida · trabalhando = animação (spark/spinner/Clawd) + ação e timer
- permissão = "!" âmbar piscando · concluído = Clawd ✓ (com som) · 1h+ ocioso = 💤
- some da barra sem sessões · Spotify = 🎧 · Cowork (Windows) = 💻
- ícone do Codex ao lado (`>_` / `>.` `>..` `>...`), some quando fechado
- **clique** = menu nativo (animação, ícone ocioso, toggles) · **clique direito** = uso
- uso = números reais do `/status` (API oficial), nunca estimado

![poses](assets/poses.png)

## Instalar / atualizar

```bash
git clone https://github.com/fabiolukas123/fabiolukas123.git claude-status-bar
cd claude-status-bar
npm install     # setup completo (Waybar no Arch, bandeja no Windows)
npm run update  # atualizar depois
```

Na Waybar não usa o módulo `tray` (nada de ícone de outros apps).
Reinicie as sessões do Claude Code após instalar.

## Arquivos

- Config: `~/.claude/statusbar/config.json` · estado: `~/.claude/statusbar/state.d/`
- Hooks entram em `~/.claude/settings.json` (com backup)
- Remover: `python uninstall.py` (`--purge` apaga tudo)
- Problema no menu: `python3 -m statusbar --menu-debug`

Assets e conceito: [m1ckc3s/claude-status-bar](https://github.com/m1ckc3s/claude-status-bar). MIT.
