#!/usr/bin/env node
/*
 * npm wrapper so install/update are one command:
 *   npm install            -> postinstall runs the full setup
 *   npm run update         -> git pull + setup again (icons, hooks, Waybar)
 *   npx . install|update   -> same, explicit
 *
 * The app itself is Python; this only orchestrates git + the platform setup
 * (setup.sh on Linux — Waybar wiring included — install.py on Windows).
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const repo = path.resolve(__dirname, "..");
const cmd = (process.argv[2] || "install").toLowerCase();
const python = process.platform === "win32" ? "python" : "python3";

function run(program, args, opts) {
  const result = spawnSync(program, args, Object.assign(
    { stdio: "inherit", cwd: repo }, opts));
  if (result.error) {
    console.error(`! falha ao executar ${program}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!["install", "update", "setup"].includes(cmd)) {
  console.log("uso: claude-status-bar [install|update]");
  process.exit(2);
}

const REMOTE = "https://github.com/FabioLukas123/FabioLukas123.git";
const BRANCH = "claude/status-bar-arch-windows-lwat6h";

function tryRun(program, args) {
  const r = spawnSync(program, args, { cwd: repo, stdio: "pipe" });
  return r.status === 0;
}

if (cmd === "update") {
  if (tryRun("git", ["rev-parse", "--is-inside-work-tree"])) {
    console.log("==> git pull...");
    run("git", ["pull", "--ff-only"]);
  } else {
    // Folder came from a GitHub ZIP download (no .git). Convert it into a
    // real clone in place, then updates work forever after.
    console.log("==> pasta veio de um ZIP (sem .git); convertendo em clone git...");
    run("git", ["init", "-b", BRANCH]);
    tryRun("git", ["remote", "remove", "origin"]);
    run("git", ["remote", "add", "origin", REMOTE]);
    run("git", ["fetch", "origin", BRANCH]);
    run("git", ["checkout", "-f", "-B", BRANCH, "--track", "origin/" + BRANCH]);
    console.log("✓ agora é um repositório git normal.");
  }
}

if (process.platform === "win32") {
  console.log("==> setup (Windows)...");
  run(python, [path.join(repo, "install.py"), "--no-autostart"]);
  run("powershell", ["-ExecutionPolicy", "Bypass", "-File",
    path.join(repo, "packaging", "windows", "install-autostart.ps1")]);
} else {
  console.log("==> setup (Linux)...");
  run("bash", [path.join(repo, "setup.sh")]);
}

console.log("✓ pronto.");
