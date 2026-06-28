' Silent launcher for the Claude Status Bar on Windows.
' Starts "pythonw -m statusbar" from the repository root with no console window.
' The repo path is injected by install-autostart.ps1; if you run this file
' directly, edit REPO_DIR below to point at your checkout.

Option Explicit

Dim shell, fso, scriptDir, repoDir, pythonw, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
' Default: two levels up from packaging\windows == repo root.
repoDir = fso.GetAbsolutePathName(scriptDir & "\..\..")

pythonw = "pythonw"
cmd = pythonw & " -m statusbar"

shell.CurrentDirectory = repoDir
shell.Environment("PROCESS")("PYTHONPATH") = repoDir
shell.Run cmd, 0, False
