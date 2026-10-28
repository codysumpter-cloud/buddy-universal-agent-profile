#!/usr/bin/env bash
# Prismtek owner-only REA bootstrap for an EXISTING persistent Codex host.
# Run as the same OS account that launches the Codex CLI.
# Does NOT install Hopper or modify unrelated MCP registrations.
set -Eeuo pipefail
umask 077

usage() { echo "Usage: $0 --dry-run|--apply|--verify" >&2; exit 64; }
mode="${1:---dry-run}"
case "$mode" in --dry-run|--apply|--verify) ;; *) usage;; esac
[[ $# -le 1 ]] || usage

for bin in node npm npx codex; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "BLOCKED: $bin was not found for this OS account. No config changed." >&2
    exit 1
  fi
done
node - <<'NODE' || { echo "BLOCKED: REA requires Node 22.23.4+, 24.22.1+, or 26.12.1+ (supported major lines only); no Node upgrade was attempted." >&2; exit 1; }
const [major, minor, patch] = process.versions.node.split('.').map(Number);
const atLeast = (m, p) => minor > m || (minor === m && patch >= p);
if (!((major === 22 && atLeast(23, 4)) || (major === 24 && atLeast(22, 1)) || (major === 26 && atLeast(12, 1)))) process.exit(1);
NODE

printf 'Host: %s | user: %s | HOME: %s\n' "$(hostname)" "$(id -un)" "$HOME"
printf 'Node: %s | npm: %s | Codex: %s\n' "$(node -v)" "$(npm -v)" "$(codex --version)"
state="${XDG_STATE_HOME:-$HOME/.local/state}/prismtek/rea-codex"
mkdir -p "$state"; chmod 700 "$state"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ "$mode" == --dry-run || "$mode" == --apply ]]; then
  plan="$state/rea-plan-$stamp.json"
  echo "REA setup preflight (read-only: no agent config changes):"
  npx -y rea-agents@latest setup --client codex --dry-run --json | tee "$plan"
  chmod 600 "$plan"
  printf '\nSaved dry-run plan: %s\n' "$plan"
  if [[ "$mode" == --dry-run ]]; then
    echo "Dry-run complete. No agent registration was applied."
    exit 0
  fi

  echo "Applying approved Codex-only setup; optional Hopper is explicitly excluded."
  install_log="$state/rea-install-$stamp.json"
  npx -y rea-agents@latest setup --client codex --yes --json | tee "$install_log"
  chmod 600 "$install_log"
fi

echo "Verifying MCP registration and installed skill:"
doctor="$state/rea-doctor-$stamp.json"
npx -y rea-agents@latest doctor --client codex --skill --json | tee "$doctor"
chmod 600 "$doctor"
printf '\nRegistered Codex MCP servers:\n'
codex mcp list
printf '\nREA diagnostics saved: %s\n' "$doctor"
echo "IMPORTANT: Restart/reconnect Codex and verify REA tools/list in the newly running client."
echo "No Hopper installation was requested."
