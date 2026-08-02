#!/bin/bash
set -euo pipefail
export TMUX_TMPDIR="/opt/forgeos/.tmux"
mkdir -p "$TMUX_TMPDIR"

tmux kill-server 2>/dev/null || true
pkill -9 -f tmux 2>/dev/null || true
sleep 2

cd /opt/forgeos
mkdir -p agents/logs agents/briefs

# launcher
cat > agents/run-agent.sh << 'EOS'
#!/bin/bash
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin"
export TMUX_TMPDIR="/opt/forgeos/.tmux"
cd /opt/forgeos
/usr/local/bin/hermes profile use forge -z "$(cat agents/briefs/brief-${1:-0}.md)" > "agents/logs/agent-${1:-0}.log" 2>&1 || true
EOS
chmod +x agents/run-agent.sh

# briefs
for i in $(seq 1 10); do
  case $i in
    1) cat > agents/briefs/brief-1.md << 'EOF'
You are ForgeOS farm agent-1. Work ONLY in /opt/forgeos/apps/brain-console. Do NOT modify /opt/forgeos/governance.
Mission: Install Playwright and run tests/e2e.spec.ts.
Steps:
1) cd /opt/forgeos/apps/brain-console
2) bun add -d @playwright/test
3) bunx playwright install chromium
4) bunx playwright test
5) Report pass/fail + any failures.
EOF
    ;;
    2) cat > agents/briefs/brief-2.md << 'EOF'
You are ForgeOS farm agent-2. Work ONLY in /opt/forgeos/apps/brain-console/src/lib. Do NOT modify the server.
Mission: Add unit tests for src/lib/api.js.
Steps:
1) cd /opt/forgeos/apps/brain-console
2) Create tests/unit/api.spec.ts covering req() success, req() HTTP error throw, api.status(), api.gov(), api.capture().
3) Run tests and report results.
EOF
    ;;
    3) cat > agents/briefs/brief-3.md << 'EOF'
You are ForgeOS farm agent-3. Work ONLY in /opt/forgeos/apps/brain-console/src. Do NOT modify the server.
Mission: Replace hand-rolled escapeHtml with DOMPurify for user-content rendering.
Steps:
1) Inspect src/app.js for all escapeHtml() usages.
2) Add DOMPurify CDN import or inline fallback (no build step).
3) Replace escapeHtml in user-content paths only; keep governance/schema text raw.
4) node --check src/app.js; served bytes must match disk bytes.
EOF
    ;;
    4) cat > agents/briefs/brief-4.md << 'EOF'
You are ForgeOS farm agent-4. Work ONLY in /opt/forgeos/apps/brain-console/src. Do NOT modify the server.
Mission: Add loading skeletons uniformly across all panels.
Steps:
1) Inspect src/app.js for panels missing skeleton/loading state.
2) Add a <div class="skeleton"> block to each render<Name>() before the first async call.
3) node --check src/app.js; served bytes must match disk bytes.
EOF
    ;;
    5) cat > agents/briefs/brief-5.md << 'EOF'
You are ForgeOS farm agent-5. Work ONLY in /opt/forgeos/apps/brain-console/server.ts. Do NOT modify /opt/forgeos/governance/.
Mission: Add /api/diff endpoint for governance audit.
Steps:
1) Read server.ts to understand route pattern.
2) Add GET /api/diff?left=<slug>&right=<slug> (return 501 with note if gbrain diff unsupported).
3) Do NOT break existing routes. Verify curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:7777/api/diff?left=a&right=b".
EOF
    ;;
    6) cat > agents/briefs/brief-6.md << 'EOF'
You are ForgeOS farm agent-6. Work ONLY in /opt/forgeos/apps/brain-console/server.ts. Do NOT modify /opt/forgeos/governance/.
Mission: Add rate-limit remaining header (X-RateLimit-Remaining).
Steps:
1) Inspect rateOk() in server.ts.
2) Add X-RateLimit-Remaining header to rate-limited /api/* responses.
3) curl -s -D - http://127.0.0.1:7777/api/status | grep -i rate must show the header.
EOF
    ;;
    7) cat > agents/briefs/brief-7.md << 'EOF'
You are ForgeOS farm agent-7. Work ONLY in /opt/forgeos/apps/brain-console. Do NOT modify the server.
Mission: Add favicon (real .ico) and deep-link share buttons.
Steps:
1) Create public/favicon.ico (use python3 -c "from PIL import Image; Image.new("RGBA",(16,16),(0,0,0,0)).save("public/favicon.ico")" or base64-decode a tiny .ico).
2) Add share button on each brain page that copies location.href to clipboard.
3) curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7777/favicon.ico must return 200 with non-zero bytes.
EOF
    ;;
    8) cat > agents/briefs/brief-8.md << 'EOF'
You are ForgeOS farm agent-8. Work ONLY in /opt/forgeos/apps/brain-console/src. Do NOT modify the server.
Mission: Add "last amended" git-history badge to /governance view.
Steps:
1) Inspect renderGovernance() in src/app.js.
2) For each governance file listed, append a relative-time badge from git log -1 --format=%cr.
3) curl http://127.0.0.1:7777/#/governance HTML must contain relative-time strings.
EOF
    ;;
    9) cat > agents/briefs/brief-9.md << 'EOF'
You are ForgeOS farm agent-9. Work ONLY in /opt/forgeos/apps/brain-console/src. Do NOT modify the server.
Mission: Add pagination for long Vault and Audit lists.
Steps:
1) Inspect renderVault() and renderAudit() in src/app.js.
2) Add "Show first 50 + load more" button to each long list panel.
3) node --check src/app.js; served bytes must match disk bytes.
EOF
    ;;
    10) cat > agents/briefs/brief-10.md << 'EOF'
You are ForgeOS farm agent-10. Work ONLY in /opt/forgeos. Do NOT modify /opt/forgeos/governance/.
Mission: Write apps/SDK.md — how to build an app on ForgeOS.
Steps:
1) Read apps/README.md, STATUS-AND-ROADMAP.md, and existing apps/.
2) Write apps/SDK.md with: scaffold pattern, manifest.json schema, consuming /services, isolated brain, CI template, deploy checklist.
3) Keep under 300 lines. Write to /opt/forgeos/apps/SDK.md.
EOF
    ;;
  esac
done

# launch
pkill -f '/opt/forgeos/agents/run-agent' 2>/dev/null || true
sleep 1
for i in $(seq 1 10); do
  tmux new-session -d -s "agent-$i" "bash /opt/forgeos/agents/run-agent.sh $i"
  sleep 0.5
done

echo "SESSIONS:"
tmux list-sessions 2>/dev/null || echo "list-failed"
echo "HERMES_PROCS:"
ps aux | grep hermes | grep -v grep | wc -l
