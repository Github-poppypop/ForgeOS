<#
.SYNOPSIS
    Sets up a self-hosted GitHub Actions runner on Windows for Github-poppypop/ForgeOS.
.DESCRIPTION
    Downloads the runner, configures it against the repo, and installs it as a
    Windows service. Does NOT start the service — start it manually afterwards.
.PARAMETER Token
    Short-lived GitHub Actions registration token. Generate from:
    https://github.com/Github-poppypop/ForgeOS/settings/actions/runners/new
.PARAMETER RunnerVersion
    GitHub Actions runner version to download. Defaults to the latest stable.
.PARAMETER InstallPath
    Destination folder for the runner. Defaults to C:\actions-runner.
.PARAMETER Name
    Runner name registered with GitHub. Defaults to windows-selfhosted.
.PARAMETER Replace
    If set, replace an existing runner with the same name.
.EXAMPLE
    $env:RUNNER_TOKEN = "<token>"
    .\scripts\setup-runner.ps1 -Token $env:RUNNER_TOKEN
.NOTES
    Run from an elevated (Administrator) PowerShell prompt.
    The token is never written to disk by this script.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Token,

    [string]$RunnerVersion = "2.331.0",

    [string]$InstallPath = "C:\actions-runner",

    [string]$Name = "windows-selfhosted",

    [switch]$Replace
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step {
    param([string]$Text)
    Write-Host "`n==> $Text`n" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# 1. Validate prerequisites
# ---------------------------------------------------------------------------
Write-Step "Validating prerequisites"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated (Administrator) PowerShell prompt."
}

if (-not (Get-Command curl -ErrorAction SilentlyContinue) -and -not (Get-Command Invoke-WebRequest -ErrorAction SilentlyContinue)) {
    throw "curl or Invoke-WebRequest is required to download the runner."
}

# ---------------------------------------------------------------------------
# 2. Download runner
# ---------------------------------------------------------------------------
Write-Step "Downloading GitHub Actions runner v$RunnerVersion"

$zipUrl  = "https://github.com/actions/runner/releases/download/v$RunnerVersion/actions-runner-win-x64-$RunnerVersion.zip"
$zipTemp = Join-Path $env:TEMP "actions-runner-win-x64-$RunnerVersion.zip"

if (Test-Path $InstallPath) {
    Write-Warning "Install path '$InstallPath' already exists. Contents will be merged/overwritten."
} else {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

Write-Host "  URL  : $zipUrl"
Write-Host "  Save : $zipTemp"

try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipTemp -UseBasicParsing
} catch {
    throw "Failed to download runner: $_"
}

Write-Host "  Extracting to $InstallPath ..."
Expand-Archive -Path $zipTemp -DestinationPath $InstallPath -Force
Remove-Item $zipTemp -ErrorAction SilentlyContinue
Write-Host "  Done." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 3. Configure runner
# ---------------------------------------------------------------------------
Write-Step "Configuring runner for Github-poppypop/ForgeOS"

$repoUrl = "https://github.com/Github-poppypop/ForgeOS"
$workDir = Join-Path $InstallPath "_work"

$configArgs = @(
    "--url", $repoUrl,
    "--token", $Token,
    "--name", $Name,
    "--labels", "self-hosted,Windows,x64",
    "--work", $workDir,
    "--unattended"
)

if ($Replace) {
    $configArgs += "--replace"
}

Write-Host "  Running config.cmd ..."
Set-Location $InstallPath

try {
    $output = & .\config.cmd @configArgs 2>&1
    $output | ForEach-Object { Write-Host "  $_" }
} catch {
    throw "Runner configuration failed: $_"
}

Write-Host "  Runner configured successfully." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4. Install as Windows service (do NOT start)
# ---------------------------------------------------------------------------
Write-Step "Installing Windows service (runner will not be started)"

# svc.sh is a Bash script bundled with the runner; on pure Windows PowerShell
# we invoke it via Git Bash or WSL if available, otherwise we use NSSM directly.
$svcScript = Join-Path $InstallPath "svc.sh"
$svcExists = Test-Path $svcScript

if ($svcExists) {
    # Prefer the bundled installer when a Bash shell is available.
    $bash = Get-Command bash -ErrorAction SilentlyContinue
    if ($bash) {
        Write-Host "  Using svc.sh (via bash) to install the service."
        & bash $svcScript install 2>&1 | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Warning "  bash not found; falling back to manual NSSM registration."
        Install-RunnerViaNssm
    }
} else {
    Install-RunnerViaNssm
}

Write-Host "`n  Service installed but NOT started." -ForegroundColor Yellow
Write-Host "  Start it manually with:`n"
Write-Host "    cd $InstallPath" -ForegroundColor White
Write-Host "    .\svc.sh start`n" -ForegroundColor White

Write-Host "  Or via PowerShell:`n"
Write-Host "    Start-Service -Name 'actions.runner.Github-poppypop.ForgeOS.$Name'`n" -ForegroundColor White

Write-Host "Setup complete." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Helper: install service via NSSM directly
# ---------------------------------------------------------------------------
function Install-RunnerViaNssm {
    param()

    $nssmPath = Join-Path $InstallPath "externals\nssm.exe"
    if (-not (Test-Path $nssmPath)) {
        throw "NSSM not found at '$nssmPath'. Install Git Bash or place nssm.exe there."
    }

    $serviceName = "actions.runner.Github-poppypop.ForgeOS.$Name"
    $serviceDisplayName = "GitHub Actions Runner ($Name)"
    $serviceDescription = "Self-hosted GitHub Actions runner for Github-poppypop/ForgeOS"

    # Remove existing service if present
    $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  Removing existing service '$serviceName' ..."
        & $nssmPath stop $serviceName | Out-Null
        & $nssmPath remove $serviceName confirm | Out-Null
    }

    Write-Host "  Creating service '$serviceName' via NSSM ..."

    # NSSM arguments: install <service> <app> <args...>
    $runScript = Join-Path $InstallPath "run.cmd"
    $args = @("install", $serviceName, $runScript)
    & $nssmPath @args | Out-Null

    # Set display name & description
    & $nssmPath set $serviceName DisplayName $serviceDisplayName | Out-Null
    & $nssmPath set $serviceName Start SERVICE_DEMAND_START | Out-Null   # Manual start
    & $nssmPath set $serviceName Description $serviceDescription | Out-Null
    & $nssmPath set $serviceName AppExitDefault Action 0 | Out-Null      # Restart on exit
    & $nssmPath set $serviceName AppRestartDelay 5000 | Out-Null         # 5 s

    Write-Host "  Service '$serviceName' created." -ForegroundColor Green
}
