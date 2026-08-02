# Self-Hosted GitHub Actions Runner on Windows

This guide walks through setting up a **Windows self-hosted runner** for the
`Github-poppypop/ForgeOS` repository. The runner lives on this machine and
executes GitHub Actions jobs locally (e.g., Playwright E2E tests against
`localhost:7777`).

> **Important:** The runner authenticates with the repo using a short-lived
> registration token generated on GitHub. Do **not** hardcode secrets or PATs
> in scripts.

---

## 1. Prerequisites

| Requirement | Details |
|-------------|---------|
| OS | Windows 10 / 11 (x64) |
| PowerShell | 5.1+ (built-in) or PowerShell 7+ |
| Network | Outbound HTTPS to `github.com` and `api.github.com` |
| Repo access | You must be a repo admin or org owner to add a runner |
| Port | `7777` must be free on the host (the brain-console service binds here) |
| Tools (optional) | `git`, `curl` (or `Invoke-WebRequest`) |

---

## 2. Download the Runner

GitHub hosts platform-specific runners. Use the latest version:

```powershell
$version = "2.328.0"   # check https://github.com/actions/runner/releases/latest
$url      = "https://github.com/actions/runner/releases/download/v$version/actions-runner-win-x64-$version.zip"
$outFile  = "$env:USERPROFILE\actions-runner.zip"

Invoke-WebRequest -Uri $url -OutFile $outFile
```

Extract to a permanent location (avoid temp directories):

```powershell
$dest = "C:\actions-runner"
Expand-Archive -Path $outFile -DestinationPath $dest -Force
Remove-Item $outFile
```

---

## 3. Get a Registration Token

A registration token is a **short-lived secret** (1 hour TTL). Generate it
from GitHub before running the config step.

### Option A — GitHub Web UI (recommended)

1. Go to `https://github.com/Github-poppypop/ForgeOS/settings/actions/runners`
2. Click **New self-hosted runner**
3. Select **Windows** and **x64**
4. Copy the provided `--token <value>` token

### Option B — GitHub CLI

```powershell
gh auth login
gh api repos/Github-poppypop/ForgeOS/actions/runners/registration-token -X POST
```

The response contains `"token": "..."`. Save it to a temporary variable or
environment variable (do **not** commit it):

```powershell
$env:RUNNER_TOKEN = "<TOKEN_FROM_ABOVE>"
```

---

## 4. Configure the Runner

Run the `config.cmd` script from the extracted folder:

```powershell
cd C:\actions-runner

.\config.cmd `
  --url https://github.com/Github-poppypop/ForgeOS `
  --token $env:RUNNER_TOKEN `
  --name windows-selfhosted `
  --labels self-hosted,Windows,x64 `
  --work _work `
  --replace
```

| Flag | Purpose |
|------|---------|
| `--url` | Repo URL to attach to |
| `--token` | Registration token from step 3 |
| `--name` | Friendly runner name shown in GitHub UI |
| `--labels` | Additional labels for workflow targeting |
| `--work` | Work directory inside the runner folder |
| `--replace` | Replace an existing runner with the same name |

After success you will see:

```
√ Successfully saved the runner configuration
```

---

## 5. Install as a Windows Service

The runner can run as a background service so it survives logouts and reboots.

```powershell
cd C:\actions-runner
.\svc.sh install
.\svc.sh start
```

Under the hood this calls NSSM (already bundled) to register `actions.runner.Github-poppypop.ForgeOS.windows-selfhosted` as a Windows service.

### Verify the service

```powershell
Get-Service -Name "actions.runner.Github-poppypop.ForgeOS.windows-selfhosted"
```

Expected output: `Status: Running`

### Configure service startup type

By default the service is `Manual`. Set it to `Automatic` if you want it to
start after reboots:

```powershell
Set-Service -Name "actions.runner.Github-poppypop.ForgeOS.windows-selfhosted" -StartupType Automatic
```

---

## 6. Verify from GitHub

1. Refresh the runners page:
   `https://github.com/Github-poppypop/ForgeOS/settings/actions/runners`
2. Your runner should appear with a green **online** dot.
3. Test it manually by creating a temporary workflow or using the **Run
   workflow** button on the E2E workflow (`.github/workflows/e2e-windows.yml`).

---

## 7. Firewall / Proxy Notes

If this machine sits behind a proxy or strict firewall, allowlist:

- `github.com`
- `api.github.com`
- `codeload.github.com`
- `*.actions.githubusercontent.com`

No inbound ports are required — the runner maintains an **outbound**
long-poll / websocket connection to GitHub.

---

## 8. Updating the Runner

```powershell
cd C:\actions-runner
.\svc.sh stop
.\config.cmd remove --token <NEW_TOKEN>
.\config.cmd --url ... --token <NEW_TOKEN> ...
.\svc.sh install
.\svc.sh start
```

---

## 9. Uninstall

```powershell
cd C:\actions-runner
.\svc.sh stop
.\svc.sh uninstall
.\config.cmd remove --token <TOKEN>
```

---

## 10. Automated Setup Script

A fully automated setup is available at:

```
scripts/setup-runner.ps1
```

It downloads, configures, and installs the service **without starting it**.
Run it from an elevated (Administrator) PowerShell prompt:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\scripts\setup-runner.ps1 -Token $env:RUNNER_TOKEN
```

After the script finishes, start the service manually:

```powershell
.\svc.sh start
```
