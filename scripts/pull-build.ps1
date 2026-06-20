# scripts/pull-build.ps1
# Automates compiling CodexMonitor on GitHub Actions and pulling the built files back.

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet('release', 'debug')]
    [string]$BuildMode = 'release'
)

# 1. Verify GitHub CLI is installed and authenticated
$ghCheck = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCheck) {
    Write-Error "GitHub CLI (gh) is not installed. Please install it first: winget install GitHub.cli"
    exit 1
}

$authCheck = gh auth status 2>&1
if ($authCheck -match "Logged in to github.com" -or $LASTEXITCODE -eq 0) {
    # Auth is OK
} else {
    Write-Error "GitHub CLI is not authenticated. Please run 'gh auth login' to authenticate."
    exit 1
}

# 2. Get current branch name
$branch = git branch --show-current
if ([string]::IsNullOrEmpty($branch)) {
    Write-Warning "Could not determine current Git branch. Defaulting to 'main'."
    $branch = 'main'
}

# 3. Check for uncommitted/unpushed workflow changes
$gitStatus = git status --porcelain ".github/workflows/build-windows-manual.yml"
if (-not [string]::IsNullOrEmpty($gitStatus)) {
    Write-Host ""
    Write-Host "WARNING: You have uncommitted changes in your workflow file." -ForegroundColor Yellow
    Write-Host "Please commit and push your changes so GitHub is aware of the workflow:" -ForegroundColor Yellow
    Write-Host "  git add .github/workflows/build-windows-manual.yml"
    Write-Host "  git commit -m 'add manual build workflow'"
    Write-Host "  git push origin $branch"
    Write-Host ""
    $confirm = Read-Host "Have you pushed the workflow to GitHub already? (y/n)"
    if ($confirm -ne 'y') {
        Write-Host "Aborting. Please push first."
        exit 1
    }
}

# 4. Trigger the GitHub Action workflow
Write-Host "Triggering workflow 'Build Windows Manual' on branch '$branch' with build_mode='$BuildMode'..." -ForegroundColor Cyan
gh workflow run build-windows-manual.yml --ref $branch -f build_mode=$BuildMode
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to trigger the workflow. Please verify that you have pushed the workflow file to GitHub."
    exit 1
}

Write-Host "Workflow triggered successfully. Waiting 10 seconds for the run to register..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# 5. Locate the triggered run ID
$runId = $null
$attempts = 0
while ($null -eq $runId -and $attempts -lt 5) {
    $runsJson = gh run list --workflow=build-windows-manual.yml --branch $branch --limit 1 --json databaseId,status,conclusion | ConvertFrom-Json
    if ($runsJson -and $runsJson.Count -gt 0) {
        $runId = $runsJson[0].databaseId
        $status = $runsJson[0].status
        Write-Host "Found active workflow run ID: $runId (Status: $status)" -ForegroundColor Green
    } else {
        $attempts++
        Write-Host "Workflow run not registered yet, retrying check ($attempts/5)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

if ($null -eq $runId) {
    Write-Error "Failed to find the workflow run on GitHub. Please check if your remote branch matches local branch '$branch'."
    exit 1
}

# 6. Poll status until completion
Write-Host "Polling workflow run status..." -ForegroundColor Cyan
$completed = $false
while (-not $completed) {
    $run = gh run view $runId --json status,conclusion | ConvertFrom-Json
    $status = $run.status
    $conclusion = $run.conclusion
    
    $timeStr = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timeStr] Run Status: $status, Conclusion: $conclusion"
    
    if ($status -eq "completed") {
        $completed = $true
        if ($conclusion -ne "success") {
            Write-Error "Workflow failed on GitHub with conclusion: $conclusion"
            exit 1
        }
    } else {
        Start-Sleep -Seconds 20
    }
}

# 7. Download and extract artifact
Write-Host "Workflow succeeded! Downloading artifacts..." -ForegroundColor Green
$downloadDir = Join-Path $PSScriptRoot "../build-artifacts"
if (Test-Path $downloadDir) {
    Remove-Item -Recurse -Force $downloadDir
}
New-Item -ItemType Directory -Path $downloadDir | Out-Null

gh run download $runId --dir $downloadDir
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to download artifacts."
    exit 1
}

# 8. Deploy executables to target build directory for ease of running
$targetSubDir = if ($BuildMode -eq 'release') { "release" } else { "debug" }
$targetDir = Join-Path $PSScriptRoot "../src-tauri/target/$targetSubDir"

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
}

Write-Host "Deploying executables to local target directory: $targetDir" -ForegroundColor Cyan
$copiedCount = 0
Get-ChildItem -Path $downloadDir -Recurse -Filter *.exe | ForEach-Object {
    $destFile = Join-Path $targetDir $_.Name
    Copy-Item -Path $_.FullName -Destination $destFile -Force
    Write-Host "  Copied: $_.Name -> $targetSubDir/" -ForegroundColor Gray
    $copiedCount++
}

Write-Host ""
Write-Host "SUCCESS!" -ForegroundColor Green
Write-Host "1. All artifacts downloaded to: $downloadDir"
Write-Host "2. Raw binaries deployed to: $targetDir (Copied $copiedCount files)"
Write-Host ""
Write-Host "You can now run CodexMonitor using:"
if ($BuildMode -eq 'release') {
    Write-Host "  $targetDir/codex-monitor.exe" -ForegroundColor Green
} else {
    Write-Host "  $targetDir/codex-monitor.exe" -ForegroundColor Green
}
