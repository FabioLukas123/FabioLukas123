# Enable the Claude Status Bar tray on login for the current Windows user.
#
# Creates a shortcut in the user's Startup folder that runs the silent VBS
# launcher (no console window). Run from the repo root, e.g.:
#   powershell -ExecutionPolicy Bypass -File packaging\windows\install-autostart.ps1

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$vbs = Join-Path $repoRoot "packaging\windows\claude-status-bar.vbs"

if (-not (Test-Path $vbs)) {
    Write-Error "Launcher not found: $vbs"
    exit 1
}

$startup = [Environment]::GetFolderPath("Startup")
$lnkPath = Join-Path $startup "Claude Status Bar.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbs`""
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = "Claude Status Bar tray indicator"
$appIco = Join-Path $repoRoot "statusbar\assets\app.ico"
if (Test-Path $appIco) { $shortcut.IconLocation = "$appIco,0" }
$shortcut.Save()

Write-Host "Installed autostart shortcut: $lnkPath"
Write-Host "Starting the tray now..."
Start-Process "wscript.exe" -ArgumentList "`"$vbs`"" -WorkingDirectory $repoRoot

Write-Host "Done. The tray will start automatically at every login."
Write-Host "To remove autostart, delete: $lnkPath"
